import { Router } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { SignupBody, LoginBody } from "@workspace/api-zod";

const router = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + process.env.SESSION_SECRET).digest("hex");
}

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

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
  res.json({ id: String(user.id), email: user.email, name: user.name, createdAt: user.createdAt.toISOString() });
});

router.post("/signup", async (req, res) => {
  const parsed = SignupBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const { email, password, name } = parsed.data;

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) return res.status(400).json({ error: "Email already in use" });

  const passwordHash = hashPassword(password);
  const [user] = await db.insert(usersTable).values({ email, name, passwordHash }).returning();

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.status(201).json({
    user: { id: String(user.id), email: user.email, name: user.name, createdAt: user.createdAt.toISOString() },
    token
  });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const { email, password } = parsed.data;

  const users = await db.select().from(usersTable).where(eq(usersTable.email, email));
  const user = users[0];
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId: user.id, token, expiresAt });

  res.json({
    user: { id: String(user.id), email: user.email, name: user.name, createdAt: user.createdAt.toISOString() },
    token
  });
});

router.post("/logout", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  }
  res.json({ success: true });
});

export default router;
