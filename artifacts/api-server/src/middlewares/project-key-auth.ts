import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db, projectKeysTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export interface ProjectKeyRequest extends Request {
  projectId?: number;
  projectKeyId?: number;
}

function hash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export async function requireProjectKey(
  req: ProjectKeyRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing project key" });
  }
  const raw = header.slice(7).trim();
  if (!raw.startsWith("pk_")) {
    return res.status(401).json({ error: "Invalid project key" });
  }
  const keyHash = hash(raw);
  const rows = await db
    .select()
    .from(projectKeysTable)
    .where(
      and(eq(projectKeysTable.keyHash, keyHash), isNull(projectKeysTable.revokedAt)),
    );
  const key = rows[0];
  if (!key) return res.status(401).json({ error: "Invalid project key" });

  // Best-effort lastUsedAt update — never block the response on this
  void db
    .update(projectKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(projectKeysTable.id, key.id))
    .catch(() => {});

  req.projectId = key.projectId;
  req.projectKeyId = key.id;
  next();
}
