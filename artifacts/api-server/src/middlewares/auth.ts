import { Request, Response, NextFunction } from "express";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  userName?: string;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
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
  req.userId = user.id;
  req.userName = user.name;
  next();
}
