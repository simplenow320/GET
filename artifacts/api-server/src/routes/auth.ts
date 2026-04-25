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
  if (!user) return res.status(401).json({ error: "Not authenticated" });
  res.json(userToResponse(user));
});

// POST /signup
router.post("/signup", authLimiter, async (req, res) => {
  const shape = SignupBody.safeParse(req.body);
  if (!shape.success) return res.status(400).json({ error: "Validation failed" });

  const parsed = StrictSignup.safeParse(shape.data);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
  }

  const { email, password, name } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) return res.status(409).json({ error: "Email already in use" });

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
  if (!shape.success) return res.status(400).json({ error: "Validation failed" });

  const parsed = StrictLogin.safeParse(shape.data);
  if (!parsed.success) return res.status(401).json({ error: "Invalid credentials" });

  const { email, password } = parsed.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const user = users[0];

  // Always run verifyPassword so timing doesn't reveal whether the email exists.
  const stored =
    user?.passwordHash ??
    "scrypt$00000000000000000000000000000000$00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
  const verdict = await verifyPassword(password, stored);

  if (!user || !verdict.ok) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

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
 */
router.post("/forgot-password", authLimiter, async (req, res) => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    // Same generic response — don't reveal whether the input shape was valid.
    return res.json({ ok: true });
  }
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

      // Build the absolute reset URL using the request origin so it works
      // across dev / preview / prod without env config.
      const origin = (req.headers.origin as string | undefined) ??
        `${req.protocol}://${req.get("host")}`;
      const resetUrl = `${origin}/reset-password/${rawToken}`;

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
    return res.status(400).json({ error: "Invalid request" });
  }
  const { token, password } = parsed.data;

  const tokenHash = hashSessionToken(token);
  const rows = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.token, tokenHash),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    );
  const reset = rows[0];
  if (!reset) {
    return res.status(400).json({ error: "This link has expired or has already been used. Request a new one." });
  }

  const newHash = await hashPassword(password);
  await db
    .update(usersTable)
    .set({ passwordHash: newHash })
    .where(eq(usersTable.id, reset.userId));

  // Single-use token: mark used immediately.
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, reset.id));

  // Force every existing session for this user to log out — anyone with a
  // hijacked session loses access the moment the password changes.
  await db.delete(sessionsTable).where(eq(sessionsTable.userId, reset.userId));

  logger.info({ audit: true, userId: reset.userId, action: "password_reset_completed" }, "audit");
  res.json({ ok: true });
});

export default router;
