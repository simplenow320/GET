import { Request, Response, NextFunction } from "express";
import { db, sessionsTable, usersTable, projectUsersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashSessionToken } from "../lib/tokens";
import { parseIdParam } from "../lib/validation";

export const SESSION_COOKIE_NAME = "gs";

export interface AuthRequest extends Request {
  userId?: number;
  userName?: string;
  userEmail?: string;
  projectRole?: "owner" | "admin" | "editor" | "viewer";
}

/**
 * Pull the session token from either the httpOnly session cookie (web) or the
 * Authorization: Bearer header (Expo / CLI / server-to-server). Cookie wins
 * when both are present.
 */
export function extractSessionToken(req: Request): string | null {
  const cookieToken = (req as any).cookies?.[SESSION_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  const raw = header.slice(7).trim();
  return raw.length > 0 ? raw : null;
}

/**
 * Resolve the user behind a session token, or null if the token is missing,
 * unknown, or expired. Looks up by hashed token so plaintext is never stored.
 */
export async function resolveSessionUser(req: Request) {
  const raw = extractSessionToken(req);
  if (!raw) return null;
  const tokenHash = hashSessionToken(raw);
  const sessions = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, tokenHash));
  const session = sessions[0];
  if (!session || session.expiresAt < new Date()) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, session.userId));
  const user = users[0];
  if (!user) return null;
  return user;
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const user = await resolveSessionUser(req);
  if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
  req.userId = user.id;
  req.userName = user.name;
  req.userEmail = user.email;
  next();
}

const ROLE_RANK: Record<string, number> = {
  owner: 40,
  admin: 30,
  editor: 20,
  viewer: 10,
};

/**
 * Require the authenticated user to be a member of the project, optionally
 * with at least the given role. Must be mounted after `requireAuth`.
 */
export function requireProjectAccess(
  minRole: "viewer" | "editor" | "admin" | "owner" = "viewer",
) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const projectId = parseIdParam(req.params.projectId);
    if (!projectId) { res.status(400).json({ error: "Invalid project ID" }); return; }
    if (!req.userId) { res.status(401).json({ error: "Not authenticated" }); return; }

    const memberships = await db
      .select()
      .from(projectUsersTable)
      .where(
        and(
          eq(projectUsersTable.projectId, projectId),
          eq(projectUsersTable.userId, req.userId),
        ),
      );
    const membership = memberships[0];

    // Same response for "doesn't exist" and "no access" — never leak existence.
    if (!membership) { res.status(403).json({ error: "Access denied" }); return; }

    const userRank = ROLE_RANK[membership.role] ?? 0;
    const requiredRank = ROLE_RANK[minRole] ?? 0;
    if (userRank < requiredRank) {
      res.status(403).json({ error: `Requires ${minRole} access or higher` }); return;    }

    req.projectRole = membership.role as AuthRequest["projectRole"];
    next();
  };
}
