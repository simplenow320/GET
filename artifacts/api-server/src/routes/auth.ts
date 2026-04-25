import { Router } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { authLimiter } from "../middlewares/rate-limit";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { hashPassword, verifyPassword } from "../lib/passwords";
import { generateSessionToken, hashSessionToken } from "../lib/tokens";
import { Email, Password, PersonName } from "../lib/validation";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function userToResponse(u: typeof usersTable.$inferSelect) {
  return {
    id: String(u.id),
    email: u.email,
    name: u.name,
    createdAt: u.createdAt.toISOString(),
  };
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
  // Loose schema first to catch missing fields per the OpenAPI contract,
  // then a stricter local schema for actual rules.
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

  logger.info({ audit: true, userId: user.id, action: "signup" }, "audit");
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

  logger.info({ audit: true, userId: user.id, action: "login" }, "audit");
  res.json({ user: userToResponse(user), token: rawToken });
});

// POST /logout
router.post("/logout", async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const raw = header.slice(7).trim();
    if (raw) {
      try {
        await db
          .delete(sessionsTable)
          .where(eq(sessionsTable.token, hashSessionToken(raw)));
      } catch (err) {
        logger.warn({ err }, "logout delete failed");
      }
    }
  }
  res.json({ success: true });
});

export default router;
