/**
 * Google OAuth routes — `Continue with Google` flow.
 *
 *  GET /auth/google           → redirect to Google authorize
 *  GET /auth/google/callback  → exchange code, find/create user, set session
 *
 * Both endpoints are GETs so the CSRF Origin gate (which only runs on
 * mutating verbs) does not apply. The state cookie + HMAC-signed state
 * parameter is the OAuth-spec CSRF protection here: an attacker who tries
 * to forge a callback can't produce a valid signature without SESSION_SECRET,
 * and even a stolen valid state requires the matching cookie set on the
 * victim's own browser at /auth/google start.
 */
import { Router, type Request, type Response } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authLimiter } from "../middlewares/rate-limit";
import { SESSION_COOKIE_NAME } from "../middlewares/auth";
import { generateSessionToken, hashSessionToken } from "../lib/tokens";
import { logger } from "../lib/logger";
import { buildAppUrl, getAppBaseUrl } from "../lib/origin";
import {
  loadGoogleOAuthConfig,
  mintState,
  verifyState,
  buildAuthorizeUrl,
  exchangeCodeForProfile,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_MS,
} from "../lib/oauth-google";

const router = Router();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches password login

/**
 * Thrown inside the find-or-create transaction when the email already
 * belongs to a *different* Google account. Caught at the callback level
 * and surfaced as `?error=oauth_conflict`.
 */
class OAuthConflictError extends Error {
  constructor(
    public readonly reason: string,
    public readonly userId: string | number,
  ) {
    super(`oauth_conflict:${reason}`);
    this.name = "OAuthConflictError";
  }
}

function getRedirectUri(): string {
  // Must EXACTLY match what's registered in Google Cloud Console.
  return `${getAppBaseUrl()}/api/auth/google/callback`;
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function setStateCookie(res: Response, state: string) {
  res.cookie(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    // SameSite=Lax allows the cookie to ride along with the top-level GET
    // navigation back from accounts.google.com. SameSite=Strict would drop
    // it (cross-site navigation) and break the flow.
    sameSite: "lax",
    path: "/",
    maxAge: OAUTH_STATE_TTL_MS,
  });
}

function clearStateCookie(res: Response) {
  res.clearCookie(OAUTH_STATE_COOKIE, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
}

/** Sanitize the optional `?next=` query param to a same-origin path. */
function safeNextParam(req: Request): string {
  const raw = req.query.next;
  if (typeof raw !== "string") return "/app/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/app/dashboard";
  // Drop anything that smells fishy — only allow simple in-app paths.
  if (raw.length > 200) return "/app/dashboard";
  return raw;
}

/**
 * GET /auth/google
 * 1. If Google OAuth isn't configured, 302 to /login?error=oauth_unavailable.
 * 2. Mint signed state, set state cookie, redirect to Google.
 */
router.get("/google", authLimiter, async (req, res) => {
  const cfg = loadGoogleOAuthConfig(getRedirectUri());
  if (!cfg) {
    logger.warn("google oauth: not configured");
    return res.redirect(buildAppUrl("/login?error=oauth_unavailable"));
  }
  const next = safeNextParam(req);
  const state = mintState(cfg.secret, next);
  setStateCookie(res, state);
  res.redirect(buildAuthorizeUrl(cfg, state));
});

/**
 * GET /auth/google/callback
 * 1. Verify state cookie matches `?state=` and that it's HMAC-valid.
 * 2. Exchange code for an access token, fetch userinfo.
 * 3. Reject unverified emails (anyone could create a Google project and lie).
 * 4. Find user by google_sub → else by email → else create.
 * 5. Issue a session cookie and redirect to next path.
 */
router.get("/google/callback", authLimiter, async (req, res) => {
  const cfg = loadGoogleOAuthConfig(getRedirectUri());
  if (!cfg) {
    return res.redirect(buildAppUrl("/login?error=oauth_unavailable"));
  }

  const cookieState = (req as any).cookies?.[OAUTH_STATE_COOKIE];
  const queryState = req.query.state;
  const code = req.query.code;

  // Always clear the state cookie — single-use, regardless of outcome.
  clearStateCookie(res);

  // The user may have hit "Cancel" on Google's consent screen, in which case
  // Google redirects here with `?error=access_denied&state=...`. Handle that
  // gracefully rather than logging it as a security event.
  if (typeof req.query.error === "string") {
    logger.info({ err: req.query.error }, "google oauth: user declined");
    return res.redirect(buildAppUrl("/login?error=oauth_cancelled"));
  }

  if (
    typeof cookieState !== "string" ||
    typeof queryState !== "string" ||
    typeof code !== "string" ||
    cookieState.length === 0 ||
    queryState.length === 0 ||
    code.length === 0 ||
    cookieState !== queryState
  ) {
    logger.warn("google oauth: state mismatch or missing code");
    return res.redirect(buildAppUrl("/login?error=oauth_state"));
  }

  const parsed = verifyState(cfg.secret, cookieState);
  if (!parsed) {
    logger.warn("google oauth: state hmac invalid");
    return res.redirect(buildAppUrl("/login?error=oauth_state"));
  }

  let profile;
  try {
    profile = await exchangeCodeForProfile(cfg, code);
  } catch (err) {
    logger.error({ err }, "google oauth: code exchange failed");
    return res.redirect(buildAppUrl("/login?error=oauth_exchange"));
  }

  // Refuse unverified emails. Google sets email_verified=false for things
  // like custom-domain Workspace accounts where the domain hasn't proved
  // ownership; trusting them would let someone "claim" any address.
  if (!profile.emailVerified) {
    logger.warn({ email: profile.email }, "google oauth: email not verified");
    return res.redirect(buildAppUrl("/login?error=oauth_unverified"));
  }

  // Lookup / link / create — wrapped in a transaction so two concurrent
  // first-time sign-ins for the same identity can't double-insert and
  // crash on the unique(email)/unique(google_sub) constraints. Each branch
  // re-checks invariants inside the txn to defend against the race window.
  //
  // Lookup order:
  //   1. By google_sub — canonical link, survives email changes.
  //   2. By email     — first-time Google sign-in for an existing password
  //                     account. We ONLY attach google_sub if the row has
  //                     no other google_sub already; otherwise we treat it
  //                     as an identity conflict (someone else's Google
  //                     account is already linked to this email) and bail
  //                     out via /login?error=oauth_conflict.
  //   3. New user     — create a passwordless account.
  let user;
  try {
    user = await db.transaction(async (tx) => {
      const bySub = (
        await tx.select().from(usersTable).where(eq(usersTable.googleSub, profile.sub))
      )[0];
      if (bySub) return bySub;

      const byEmail = (
        await tx.select().from(usersTable).where(eq(usersTable.email, profile.email))
      )[0];
      if (byEmail) {
        if (byEmail.googleSub && byEmail.googleSub !== profile.sub) {
          // Different Google account already linked. Refuse rather than
          // silently overwrite the linkage.
          throw new OAuthConflictError("email_already_linked", byEmail.id);
        }
        const [updated] = await tx
          .update(usersTable)
          .set({ googleSub: profile.sub })
          .where(eq(usersTable.id, byEmail.id))
          .returning();
        logger.info(
          { audit: true, userId: updated.id, action: "google_link" },
          "audit",
        );
        return updated;
      }

      const [created] = await tx
        .insert(usersTable)
        .values({
          email: profile.email,
          name: profile.name || profile.email.split("@")[0],
          passwordHash: null,
          googleSub: profile.sub,
        })
        .returning();
      logger.info(
        { audit: true, userId: created.id, action: "google_signup" },
        "audit",
      );
      return created;
    });
  } catch (err) {
    if (err instanceof OAuthConflictError) {
      logger.warn(
        { audit: true, userId: err.userId, action: "google_conflict", reason: err.reason },
        "audit",
      );
      return res.redirect(buildAppUrl("/login?error=oauth_conflict"));
    }
    // Unique-violation race: another concurrent callback won the insert.
    // Postgres error code 23505 = unique_violation. Re-resolve and fall
    // through; if we still can't find the user, redirect with a generic
    // exchange error rather than 500'ing the callback.
    const code = (err as { code?: string } | null)?.code;
    if (code === "23505") {
      logger.warn({ err }, "google oauth: unique violation, re-resolving");
      const fallback =
        (
          await db.select().from(usersTable).where(eq(usersTable.googleSub, profile.sub))
        )[0] ??
        (
          await db.select().from(usersTable).where(eq(usersTable.email, profile.email))
        )[0];
      if (!fallback) {
        logger.error({ err }, "google oauth: race fallback failed");
        return res.redirect(buildAppUrl("/login?error=oauth_exchange"));
      }
      user = fallback;
    } else {
      logger.error({ err }, "google oauth: user resolution failed");
      return res.redirect(buildAppUrl("/login?error=oauth_exchange"));
    }
  }

  const rawToken = generateSessionToken();
  await db.insert(sessionsTable).values({
    userId: user.id,
    token: hashSessionToken(rawToken),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  setSessionCookie(res, rawToken);
  logger.info({ audit: true, userId: user.id, action: "google_login" }, "audit");
  res.redirect(buildAppUrl(parsed.next));
});

export default router;
