import { Router } from "express";
import { db, draftsTable, contentFieldsTable, activityTable, projectUsersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { publishLimiter } from "../middlewares/rate-limit";

const router = Router({ mergeParams: true });

function draftToResponse(d: typeof draftsTable.$inferSelect) {
  return {
    id: String(d.id),
    projectId: String(d.projectId),
    fieldId: String(d.fieldId),
    fieldLabel: d.fieldLabel,
    value: d.value,
    status: d.status,
    authorName: d.authorName,
    createdAt: d.createdAt.toISOString(),
    publishedAt: d.publishedAt?.toISOString(),
  };
}

// GET / — any project member can view drafts
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const drafts = await db.select().from(draftsTable).where(eq(draftsTable.projectId, projectId));
  res.json(drafts.map(draftToResponse));
});

// POST /:draftId/publish — admin+ only, rate limited
router.post(
  "/:draftId/publish",
  requireAuth,
  requireProjectAccess("admin"),
  publishLimiter,
  async (req: AuthRequest, res) => {
    const draftId = parseInt(req.params.draftId);
    const projectId = parseInt(req.params.projectId);

    const drafts = await db
      .select()
      .from(draftsTable)
      .where(and(eq(draftsTable.id, draftId), eq(draftsTable.projectId, projectId)));
    const draft = drafts[0];
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    if (draft.status !== "pending") {
      return res.status(409).json({ error: "Draft is not in pending state" });
    }

    // Publish: copy draft value to content field's live value, clear draftValue
    await db
      .update(contentFieldsTable)
      .set({ value: draft.value, draftValue: null })
      .where(eq(contentFieldsTable.id, draft.fieldId));

    const [published] = await db
      .update(draftsTable)
      .set({ status: "published", publishedAt: new Date() })
      .where(eq(draftsTable.id, draftId))
      .returning();

    // Log publish action
    await db.insert(activityTable).values({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: "published draft for",
      fieldLabel: draft.fieldLabel,
      newValue: draft.value,
    });

    res.json(draftToResponse(published));
  }
);

// POST /:draftId/reject — admin+ only
router.post(
  "/:draftId/reject",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const draftId = parseInt(req.params.draftId);
    const projectId = parseInt(req.params.projectId);

    const drafts = await db
      .select()
      .from(draftsTable)
      .where(and(eq(draftsTable.id, draftId), eq(draftsTable.projectId, projectId)));
    const draft = drafts[0];
    if (!draft) return res.status(404).json({ error: "Draft not found" });
    if (draft.status !== "pending") {
      return res.status(409).json({ error: "Draft is not in pending state" });
    }

    const [rejected] = await db
      .update(draftsTable)
      .set({ status: "rejected" })
      .where(eq(draftsTable.id, draftId))
      .returning();

    await db.insert(activityTable).values({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: "rejected draft for",
      fieldLabel: draft.fieldLabel,
      newValue: null,
    });

    res.json(draftToResponse(rejected));
  }
);

export default router;
