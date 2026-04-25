import { Router } from "express";
import { db, draftsTable, contentFieldsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const drafts = await db.select().from(draftsTable).where(eq(draftsTable.projectId, projectId));
  res.json(drafts.map(d => ({
    id: String(d.id), projectId: String(d.projectId), fieldId: String(d.fieldId),
    fieldLabel: d.fieldLabel, value: d.value, status: d.status, authorName: d.authorName,
    createdAt: d.createdAt.toISOString(), publishedAt: d.publishedAt?.toISOString()
  })));
});

router.post("/:draftId/publish", requireAuth, async (req: AuthRequest, res) => {
  const draftId = parseInt(req.params.draftId);
  const projectId = parseInt(req.params.projectId);
  const drafts = await db.select().from(draftsTable)
    .where(and(eq(draftsTable.id, draftId), eq(draftsTable.projectId, projectId)));
  const draft = drafts[0];
  if (!draft) return res.status(404).json({ error: "Not found" });

  await db.update(contentFieldsTable)
    .set({ value: draft.value })
    .where(eq(contentFieldsTable.id, draft.fieldId));

  const [published] = await db.update(draftsTable)
    .set({ status: "published", publishedAt: new Date() })
    .where(eq(draftsTable.id, draftId))
    .returning();
  res.json({
    id: String(published.id), projectId: String(published.projectId), fieldId: String(published.fieldId),
    fieldLabel: published.fieldLabel, value: published.value, status: published.status,
    authorName: published.authorName, createdAt: published.createdAt.toISOString(),
    publishedAt: published.publishedAt?.toISOString()
  });
});

export default router;
