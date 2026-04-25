import { Request, Response, NextFunction } from "express";
import { db, sessionsTable, usersTable, projectUsersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  userName?: string;
  userEmail?: string;
  projectRole?: "owner" | "admin" | "editor" | "viewer";
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
  req.userEmail = user.email;
  next();
}

/**
 * Require the authenticated user to be a member of the project.
 * Pass a minimum role to also enforce role-based access:
 *   "viewer" — any member
 *   "editor" — editor, admin, or owner
 *   "admin"  — admin or owner
 *   "owner"  — owner only
 */
const ROLE_RANK: Record<string, number> = {
  owner: 40,
  admin: 30,
  editor: 20,
  viewer: 10,
};

export function requireProjectAccess(minRole: "viewer" | "editor" | "admin" | "owner" = "viewer") {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const projectId = parseInt(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: "Invalid project ID" });

    const memberships = await db
      .select()
      .from(projectUsersTable)
      .where(
        and(
          eq(projectUsersTable.projectId, projectId),
          eq(projectUsersTable.userId, req.userId!)
        )
      );
    const membership = memberships[0];

    if (!membership) {
      return res.status(403).json({ error: "Access denied" });
    }

    const userRank = ROLE_RANK[membership.role] ?? 0;
    const requiredRank = ROLE_RANK[minRole] ?? 0;

    if (userRank < requiredRank) {
      return res.status(403).json({ error: `Requires ${minRole} access or higher` });
    }

    req.projectRole = membership.role as AuthRequest["projectRole"];
    next();
  };
}
