import { Router } from "express";
import { db, projectKeysTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import crypto from "crypto";

const router = Router({ mergeParams: true });

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function keyToResponse(k: typeof projectKeysTable.$inferSelect) {
  return {
    id: String(k.id),
    projectId: String(k.projectId),
    name: k.name,
    keyPrefix: k.keyPrefix,
    createdAt: k.createdAt.toISOString(),
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    revoked: !!k.revokedAt,
  };
}

// GET / — list active keys (never expose the full key)
router.get("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const keys = await db
    .select()
    .from(projectKeysTable)
    .where(and(eq(projectKeysTable.projectId, projectId), isNull(projectKeysTable.revokedAt)));
  res.json(keys.map(keyToResponse));
});

// POST / — generate a new key (admin+)
// Returns the raw key ONCE — never stored
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const name: string = (req.body?.name ?? "Project key").toString().trim().slice(0, 64) || "Project key";

  const rawKey = `pk_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 10); // e.g. "pk_3a9f2b"
  const keyHash = hashKey(rawKey);

  const [key] = await db
    .insert(projectKeysTable)
    .values({ projectId, name, keyPrefix, keyHash })
    .returning();

  // Return the raw key exactly once — client must save it
  res.status(201).json({
    ...keyToResponse(key),
    rawKey, // only present at creation
  });
});

// DELETE /:keyId — revoke a key (owner only)
router.delete("/:keyId", requireAuth, requireProjectAccess("owner"), async (req: AuthRequest, res) => {
  const keyId = parseInt(req.params.keyId);
  const projectId = parseInt(req.params.projectId);

  const keys = await db
    .select()
    .from(projectKeysTable)
    .where(and(eq(projectKeysTable.id, keyId), eq(projectKeysTable.projectId, projectId)));
  if (!keys.length) return res.status(404).json({ error: "Key not found" });

  await db
    .update(projectKeysTable)
    .set({ revokedAt: new Date() })
    .where(eq(projectKeysTable.id, keyId));

  res.status(204).send();
});

export default router;
