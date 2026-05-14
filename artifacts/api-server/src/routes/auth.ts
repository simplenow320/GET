import { Router, type Response } from "express";
import { db, usersTable, sessionsTable, passwordResetTokensTable } from "@workspace/db";
import { eq, and, isNull, gt } from "drizzle-orm";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { authLimiter } from "../middlewares/rate-limit";
import {
  requireAuth,
  AuthRequest,
  extractSessionToken,
  SESSION_COOKIE_NAME,
} from "../middlewares/auth";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { generateSessionToken, hashSessionToken } from "../lib/tokens";
import { Email, Password, PersonName } from "../lib/validation";
import { logger } from "../lib/logger";
import { sendPasswordResetEmail } from "../lib/email";
import { buildAppUrl } from "../lib/origin";
import { z } from "zod";

const router = Router();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

function userToResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: String(u.id),
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
  };
}

/**
 * Set the session cookie. HttpOnly + SameSite=Lax + Secure (Replit always
 * serves over https via its proxy). Path=/ so every artifact under the same
 * origin sees it.
 */
function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  });
}

const StrictSignup = z.object({ email: Email, password: Password, name: PersonName });
const StrictLogin = z.object({ email: Email, password: Password });

// GET /me — current user
router.get("/me", requireAuth, async (req: AuthRequest, res) => {
  const users = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  const user = users[0];
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  res.json(userToResponse(user));
});

// POST /signup
router.post("/signup", authLimiter, async (req, res) => {
  const shape = SignupBody.safeParse(req.body);
  if (!shape.success) { res.status(400).json({ error: "Validation failed" }); return; }

  const parsed = StrictSignup.safeParse(shape.data);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }); return;  }

  const { email, password, name } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) { res.status(409).json({ error: "Email already in use" }); return; }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ email, name, passwordHash })
    .returning();

  const rawToken = generateSessionToken();
  await db.insert(sessionsTable).values({
    userId: user.id,
    token: hashSessionToken(rawToken),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  setSessionCookie(res, rawToken);
  logger.info({ audit: true, userId: user.id, action: "signup" }, "audit");
  // The `token` field is preserved for non-browser clients (Expo, CLI). Browsers
  // get the cookie set above and should ignore this field.
  res.status(201).json({ user: userToResponse(user), token: rawToken });
});

// POST /login
router.post("/login", authLimiter, async (req, res) => {
  const shape = LoginBody.safeParse(req.body);
  if (!shape.success) { res.status(400).json({ error: "Validation failed" }); return; }

  const parsed = StrictLogin.safeParse(shape.data);
  if (!parsed.success) { res.status(401).json({ error: "Invalid credentials" }); return; }

  const { email, password } = parsed.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const user = users[0];

  // Always run verifyPassword so timing doesn't reveal whether the email exists.
  const stored =
    user?.passwordHash ??
    "scrypt$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const verdict = await verifyPassword(password, stored);

  if (!user || !verdict.ok) {
    res.status(401).json({ error: "Invalid credentials" }); return;  }

  // Migrate legacy SHA-256 hashes to scrypt on successful login.
  if (verdict.needsRehash) {
    try {
      const upgraded = await hashPassword(password);
      await db
        .update(usersTable)
        .set({ passwordHash: upgraded })
        .where(eq(usersTable.id, user.id));
    } catch (err) {
      logger.warn({ err, userId: user.id }, "password rehash failed");
    }
  }

  const rawToken = generateSessionToken();
  await db.insert(sessionsTable).values({
    userId: user.id,
    token: hashSessionToken(rawToken),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });

  setSessionCookie(res, rawToken);
  logger.info({ audit: true, userId: user.id, action: "login" }, "audit");
  res.json({ user: userToResponse(user), token: rawToken });
});

// POST /logout — accepts either a cookie or a Bearer header.
router.post("/logout", async (req, res) => {
  const raw = extractSessionToken(req);
  if (raw) {
    try {
      await db
        .delete(sessionsTable)
        .where(eq(sessionsTable.token, hashSessionToken(raw)));
    } catch (err) {
      logger.warn({ err }, "logout delete failed");
    }
  }
  clearSessionCookie(res);
  res.json({ success: true });
});

// ── Password reset ─────────────────────────────────────────────────────────

const ForgotPasswordBody = z.object({ email: Email });
const ResetPasswordBody = z.object({
  token: z.string().min(20).max(200),
  password: Password,
});

/**
 * POST /forgot-password
 * Always returns 200 with a generic message — never leaks whether the email
 * exists in our DB. Behind the scenes, if a matching user is found, we mint
 * a single-use token and email them a reset link.
 *
 * No-enumeration guarantee comes from THREE layers:
 *   1. Identical response status + body in every branch.
 *   2. Identical error-handling — internal errors are swallowed and logged.
 *   3. Identical wall-clock latency floor — we hold the response for at
 *      least MIN_RESPONSE_MS regardless of branch, so an attacker timing
 *      the endpoint can't distinguish "user exists, did 2 DB writes + queued
 *      email" from "user does not exist, did 1 cheap DB read".
 */
const MIN_FORGOT_PASSWORD_RESPONSE_MS = 350;

router.post("/forgot-password", authLimiter, async (req, res) => {
  // Floor the response time: even branches that finish in <50ms wait until
  // MIN_FORGOT_PASSWORD_RESPONSE_MS has elapsed. This swamps the per-request
  // variance between the existing-email branch (extra UPDATE + INSERT + queued
  // SendGrid call) and the unknown-email branch (single SELECT).
  const startedAt = Date.now();
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (parsed.success) {
    const { email } = parsed.data;
    try {
      const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
      const user = users[0];

      if (user) {
        // Invalidate any earlier unused tokens for this user — only the latest
        // link should ever work.
        await db
          .update(passwordResetTokensTable)
          .set({ usedAt: new Date() })
          .where(
            and(
              eq(passwordResetTokensTable.userId, user.id),
              isNull(passwordResetTokensTable.usedAt),
            ),
          );

        const rawToken = generateSessionToken();
        await db.insert(passwordResetTokensTable).values({
          userId: user.id,
          token: hashSessionToken(rawToken),
          expiresAt: new Date(Date.now() + RESET_TTL_MS),
        });

        // Reset URL is built from the trusted, server-configured app base URL
        // — NEVER from request headers, which an attacker can forge to make
        // us email out attacker-controlled links carrying real tokens.
        const resetUrl = buildAppUrl(`/reset-password/${rawToken}`);

        // Fire-and-forget — never block the response on email send. If SendGrid
        // is misconfigured we still want a generic 200.
        sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl }).catch((err) => {
          logger.warn({ err, userId: user.id }, "password reset email failed");
        });
        logger.info({ audit: true, userId: user.id, action: "password_reset_requested" }, "audit");
      }
    } catch (err) {
      // Never let internal errors leak — but DO log them.
      logger.error({ err }, "forgot-password handler error");
    }
  }

  const elapsed = Date.now() - startedAt;
  const remaining = MIN_FORGOT_PASSWORD_RESPONSE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((r) => setTimeout(r, remaining));
  }

  res.json({ ok: true });
});

/**
 * POST /reset-password
 * Validate token + expiry, update the user's password, mark the token used,
 * AND invalidate every existing session for that user so old devices are
 * forced to re-authenticate.
 */
router.post("/reset-password", authLimiter, async (req, res) => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" }); return;  }
  const { token, password } = parsed.data;

  const tokenHash = hashSessionToken(token);
  // Hash the new password OUTSIDE the transaction — scrypt is intentionally
  // slow and we don't want to hold a row-lock during it.
  const newHash = await hashPassword(password);

  // Atomic single-use consume: the UPDATE … WHERE used_at IS NULL is the
  // compare-and-set. Only one concurrent request can flip the row from unused
  // → used, and only that request gets the userId back. Everything else
  // (password change + session revocation) happens inside the same txn so a
  // mid-flight failure can't leave the password changed but sessions intact
  // (or vice versa).
  const consumedUserId = await db.transaction(async (tx) => {
    const consumed = await tx
      .update(passwordResetTokensTable)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokensTable.token, tokenHash),
          isNull(passwordResetTokensTable.usedAt),
          gt(passwordResetTokensTable.expiresAt, new Date()),
        ),
      )
      .returning({ userId: passwordResetTokensTable.userId });

    const userId = consumed[0]?.userId;
    if (!userId) return null;

    await tx
      .update(usersTable)
      .set({ passwordHash: newHash })
      .where(eq(usersTable.id, userId));

    // Force every existing session for this user to log out — anyone with a
    // hijacked session loses access the moment the password changes.
    await tx.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    return userId;
  });

  if (!consumedUserId) {
    res.status(400).json({ error: "This link has expired or has already been used. Request a new one." }); return;  }

  logger.info({ audit: true, userId: consumedUserId, action: "password_reset_completed" }, "audit");
  res.json({ ok: true });
});

export default router;
