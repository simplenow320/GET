import { Router } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { SignupBody, LoginBody } from "@workspace/api-zod";
import { authLimiter } from "../middlewares/rate-limit";

const router = Router();

function hashPassword(password: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return crypto.createHash("sha256").update(password + secret).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// GET /me — validate current session
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.slice(7);
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token));
  const session = sessions[0];
  if (!session || session.expiresAt < new Date()) {
    return res.status(401).json({ error: "Invalid or expired session" });
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  const user = users[0];
  if (!user) return res.status(401).json({ error: "User not found" });
  res.json({
    id: String(user.id),
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  });
});

// POST /signup — rate limited
router.post("/signup", authLimiter, async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.issues });

  const { email, password, name } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, emailLower));
  if (existing.length > 0) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email: emailLower, name: name.trim(), passwordHash }).returning();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.status(201).json({
    user: { id: String(user.id), email: user.email, name: user.name, createdAt: user.createdAt.toISOString() },
    token,
  });
});

// POST /login — rate limited
router.post("/login", authLimiter, async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const { email, password } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  const users = await db.select().from(usersTable).where(eq(usersTable.email, emailLower));
  const user = users[0];

  // Constant-time comparison — always hash before comparing
  const hash = hashPassword(password);
  if (!user || user.passwordHash !== hash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.json({
    user: { id: String(user.id), email: user.email, name: user.name, createdAt: user.createdAt.toISOString() },
    token,
  });
});

// POST /logout — invalidate token
router.post("/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ success: true });
});

export default router;
