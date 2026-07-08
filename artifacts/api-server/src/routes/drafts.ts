import { Router } from "express";
import { db, draftsTable, contentFieldsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { publishLimiter } from "../middlewares/rate-limit";
import { logAudit } from "../lib/audit";
import { parseIdParam } from "../lib/validation";

const router = Router({ mergeParams: true });

function draftToResponse(d: typeof draftsTable.$inferSelect, previousValue?: string | null) {
  return {
    id: String(d.id),
    projectId: String(d.projectId),
    fieldId: String(d.fieldId),
    fieldLabel: d.fieldLabel,
    value: d.value,
    // The field's current live value at fetch time — lets the review queue
    // show a before/after diff instead of just the proposed value in
    // isolation. Undefined (not null) when the source field was deleted.
    previousValue,
    status: d.status,
    authorName: d.authorName,
    createdAt: d.createdAt.toISOString(),
    publishedAt: d.publishedAt?.toISOString(),
  };
}

// GET / — any member
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseIdParam(req.params.projectId)!;
  const rows = await db
    .select({ draft: draftsTable, currentValue: contentFieldsTable.value })
    .from(draftsTable)
    .leftJoin(contentFieldsTable, eq(contentFieldsTable.id, draftsTable.fieldId))
    .where(eq(draftsTable.projectId, projectId));
  res.json(rows.map(({ draft, currentValue }) => draftToResponse(draft, currentValue)));
});

// POST /:draftId/publish — admin+, rate limited
router.post(
  "/:draftId/publish",
  requireAuth,
  requireProjectAccess("admin"),
  publishLimiter,
  async (req: AuthRequest, res) => {
    const draftId = parseIdParam(req.params.draftId);
    const projectId = parseIdParam(req.params.projectId)!;
    if (!draftId) { res.status(400).json({ error: "Invalid draft ID" }); return; }

    const drafts = await db
      .select()
      .from(draftsTable)
      .where(and(eq(draftsTable.id, draftId), eq(draftsTable.projectId, projectId)));
    const draft = drafts[0];
    if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
    if (draft.status !== "pending") {
      res.status(409).json({ error: "Draft is not in pending state" }); return;    }

    // Wrap the live-content update and the draft state change in a single
    // transaction so we never end up with the field updated but the draft
    // still pending (or vice versa).
    const published = await db.transaction(async (tx) => {
      const fields = await tx
        .select()
        .from(contentFieldsTable)
        .where(
          and(
            eq(contentFieldsTable.id, draft.fieldId),
            eq(contentFieldsTable.projectId, projectId),
          ),
        );
      if (!fields[0]) {
        throw new Error("FIELD_GONE");
      }

      await tx
        .update(contentFieldsTable)
        .set({ value: draft.value, draftValue: null })
        .where(
          and(
            eq(contentFieldsTable.id, draft.fieldId),
            eq(contentFieldsTable.projectId, projectId),
          ),
        );

      const [row] = await tx
        .update(draftsTable)
        .set({ status: "published", publishedAt: new Date() })
        .where(and(eq(draftsTable.id, draftId), eq(draftsTable.status, "pending")))
        .returning();

      if (!row) {
        // Another concurrent publish/reject won the race.
        throw new Error("ALREADY_RESOLVED");
      }
      return row;
    }).catch((err: Error) => {
      if (err.message === "FIELD_GONE") return { __error: 404, message: "Source field no longer exists" } as const;
      if (err.message === "ALREADY_RESOLVED") return { __error: 409, message: "Draft is no longer pending" } as const;
      throw err;
    });

    if ("__error" in published) {
      res.status(published.__error).json({ error: published.message }); return;    }

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: "published draft for",
      fieldLabel: draft.fieldLabel,
      newValue: draft.value,
    });

    res.json(draftToResponse(published));
  },
);

// POST /:draftId/reject — admin+
router.post(
  "/:draftId/reject",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const draftId = parseIdParam(req.params.draftId);
    const projectId = parseIdParam(req.params.projectId)!;
    if (!draftId) { res.status(400).json({ error: "Invalid draft ID" }); return; }

    const drafts = await db
      .select()
      .from(draftsTable)
      .where(and(eq(draftsTable.id, draftId), eq(draftsTable.projectId, projectId)));
    const draft = drafts[0];
    if (!draft) { res.status(404).json({ error: "Draft not found" }); return; }
    if (draft.status !== "pending") {
      res.status(409).json({ error: "Draft is not in pending state" }); return;    }

    const [rejected] = await db
      .update(draftsTable)
      .set({ status: "rejected" })
      .where(eq(draftsTable.id, draftId))
      .returning();

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: "rejected draft for",
      fieldLabel: draft.fieldLabel,
    });

    res.json(draftToResponse(rejected));
  },
);

export default router;
