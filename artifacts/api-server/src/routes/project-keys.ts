import { Router } from "express";
import { db, projectKeysTable } from "@workspace/db";
import { eq, and, isNull } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import crypto from "crypto";
import { KeyName, parseIdParam } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router = Router({ mergeParams: true });

const StrictCreateKey = z.object({ name: KeyName.optional() });

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

// GET / — admin+ (keys are sensitive, viewers don't need them)
router.get("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const keys = await db
    .select()
    .from(projectKeysTable)
    .where(and(eq(projectKeysTable.projectId, projectId), isNull(projectKeysTable.revokedAt)));
  res.json(keys.map(keyToResponse));
});

// POST / — admin+. Returns the raw key exactly once.
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);

  const parsed = StrictCreateKey.safeParse(req.body ?? {});
  const name = parsed.success && parsed.data.name ? parsed.data.name : "Project key";

  const rawKey = `pk_${crypto.randomBytes(24).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 10);
  const keyHash = hashKey(rawKey);

  const [key] = await db
    .insert(projectKeysTable)
    .values({ projectId, name, keyPrefix, keyHash })
    .returning();

  await logAudit({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action: `generated project key (${keyPrefix}…)`,
  });

  // rawKey is only present at creation; never persisted in cleartext.
  res.status(201).json({ ...keyToResponse(key), rawKey });
});

// DELETE /:keyId — owner only
router.delete(
  "/:keyId",
  requireAuth,
  requireProjectAccess("owner"),
  async (req: AuthRequest, res) => {
    const keyId = parseIdParam(req.params.keyId);
    const projectId = parseInt(req.params.projectId);
    if (!keyId) return res.status(400).json({ error: "Invalid key ID" });

    const keys = await db
      .select()
      .from(projectKeysTable)
      .where(and(eq(projectKeysTable.id, keyId), eq(projectKeysTable.projectId, projectId)));
    const key = keys[0];
    if (!key) return res.status(404).json({ error: "Key not found" });

    await db
      .update(projectKeysTable)
      .set({ revokedAt: new Date() })
      .where(eq(projectKeysTable.id, keyId));

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: `revoked project key (${key.keyPrefix}…)`,
    });

    res.status(204).send();
  },
);

export default router;
