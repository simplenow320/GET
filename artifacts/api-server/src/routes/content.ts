import { Router } from "express";
import { db, contentFieldsTable, draftsTable, contentSnapshotsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateContentFieldBody, UpdateContentFieldBody } from "@workspace/api-zod";
import { sanitizeContent } from "../lib/sanitize";
import { logAudit } from "../lib/audit";
import { FieldLabel, ContentValue, SelectorString, parseIdParam } from "../lib/validation";
import { z } from "zod";

const router = Router({ mergeParams: true });

const FIELD_TYPES = ["text", "richtext", "image", "url", "number", "boolean"] as const;

const StrictCreateField = z.object({
  label: FieldLabel,
  type: z.enum(FIELD_TYPES),
  selector: SelectorString,
  value: ContentValue.optional().nullable(),
});

const StrictUpdateField = z.object({
  label: FieldLabel.optional(),
  value: ContentValue.optional().nullable(),
  draftValue: ContentValue.optional().nullable(),
  isLocked: z.boolean().optional(),
});

function fieldToResponse(f: typeof contentFieldsTable.$inferSelect) {
  return {
    id: String(f.id),
    projectId: String(f.projectId),
    label: f.label,
    type: f.type,
    selector: f.selector ?? undefined,
    value: f.value ?? undefined,
    draftValue: f.draftValue ?? undefined,
    isLocked: f.isLocked,
    updatedAt: f.updatedAt?.toISOString(),
  };
}

// GET / — any member
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));
  res.json(fields.map(fieldToResponse));
});

// POST / — admin+
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const shape = CreateContentFieldBody.safeParse(req.body);
  if (!shape.success) return res.status(400).json({ error: "Validation failed" });
  const parsed = StrictCreateField.safeParse(shape.data);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
  }

  const [field] = await db
    .insert(contentFieldsTable)
    .values({
      projectId,
      label: parsed.data.label,
      type: parsed.data.type,
      selector: parsed.data.selector ?? null,
      value: parsed.data.value ? sanitizeContent(parsed.data.value) : null,
    })
    .returning();

  await logAudit({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action: "added field",
    fieldLabel: field.label,
  });

  res.status(201).json(fieldToResponse(field));
});

// PATCH /:fieldId — role-split (editors submit drafts; admins go live immediately)
router.patch(
  "/:fieldId",
  requireAuth,
  requireProjectAccess("editor"),
  async (req: AuthRequest, res) => {
    const fieldId = parseIdParam(req.params.fieldId);
    const projectId = parseInt(req.params.projectId);
    if (!fieldId) return res.status(400).json({ error: "Invalid field ID" });

    const role = req.projectRole!;
    const shape = UpdateContentFieldBody.safeParse(req.body);
    if (!shape.success) return res.status(400).json({ error: "Validation failed" });
    const parsed = StrictUpdateField.safeParse(shape.data);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
    }
    const data = parsed.data;

    // Admin+ only: lock toggle, live `value`, and label changes.
    const adminOnlyChange =
      data.isLocked !== undefined || data.value !== undefined || data.label !== undefined;
    if (adminOnlyChange && !["owner", "admin"].includes(role)) {
      return res
        .status(403)
        .json({ error: "Requires admin access to change lock state, label, or live value" });
    }

    const existing = await db
      .select()
      .from(contentFieldsTable)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));
    const field = existing[0];
    if (!field) return res.status(404).json({ error: "Field not found" });

    if (field.isLocked && data.draftValue !== undefined && !["owner", "admin"].includes(role)) {
      return res.status(403).json({ error: "This field is locked" });
    }

    const updatePayload: Partial<typeof contentFieldsTable.$inferInsert> = {};
    if (data.isLocked !== undefined) updatePayload.isLocked = data.isLocked;
    if (data.label !== undefined) updatePayload.label = data.label;
    if (data.value !== undefined)
      updatePayload.value = data.value === null ? null : sanitizeContent(data.value);

    let sanitizedDraft: string | null = null;
    if (data.draftValue !== undefined) {
      sanitizedDraft = data.draftValue === null ? null : sanitizeContent(data.draftValue);

      const isOwnerOrAdmin = ["owner", "admin"].includes(role);

      if (sanitizedDraft !== null) {
        if (isOwnerOrAdmin) {
          updatePayload.value = sanitizedDraft;
          updatePayload.draftValue = null;
          await db.insert(draftsTable).values({
            projectId,
            fieldId,
            fieldLabel: field.label,
            value: sanitizedDraft,
            authorName: req.userName!,
            status: "published",
            publishedAt: new Date(),
          });
        } else {
          updatePayload.draftValue = sanitizedDraft;
          await db.insert(draftsTable).values({
            projectId,
            fieldId,
            fieldLabel: field.label,
            value: sanitizedDraft,
            authorName: req.userName!,
            status: "pending",
          });
        }
      } else {
        updatePayload.draftValue = null;
      }
    }

    const [updated] = await db
      .update(contentFieldsTable)
      .set(updatePayload)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)))
      .returning();

    const action =
      data.draftValue !== undefined
        ? "submitted draft for"
        : data.isLocked !== undefined
          ? data.isLocked
            ? "locked field"
            : "unlocked field"
          : data.value !== undefined
            ? "updated live value"
            : "updated field";

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action,
      fieldLabel: updated.label,
      newValue: data.value ?? sanitizedDraft ?? null,
    });

    res.json(fieldToResponse(updated));
  },
);

// DELETE /:fieldId — admin+
router.delete(
  "/:fieldId",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const fieldId = parseIdParam(req.params.fieldId);
    const projectId = parseInt(req.params.projectId);
    if (!fieldId) return res.status(400).json({ error: "Invalid field ID" });

    const existing = await db
      .select()
      .from(contentFieldsTable)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));
    const field = existing[0];
    if (!field) return res.status(404).json({ error: "Field not found" });

    await db
      .delete(contentFieldsTable)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: "deleted field",
      fieldLabel: field.label,
    });

    res.status(204).send();
  },
);

// POST /pull-from-site — admin+
// Reads the latest snapshot captured by the browser scanner script.
// No external URL fetch — the scanner pushes data to us from inside the app.
router.post(
  "/pull-from-site",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const projectId = parseInt(req.params.projectId);

    const rows = await db
      .select()
      .from(contentSnapshotsTable)
      .where(eq(contentSnapshotsTable.projectId, projectId));

    if (rows.length === 0) {
      return res.status(404).json({
        error: "No scan found yet. Add the scanner script to your app, visit the page, then try again.",
      });
    }

    const snapshot = rows[0];
    return res.json({
      url: snapshot.pageUrl ?? "",
      capturedAt: snapshot.capturedAt,
      sections: snapshot.sections,
    });
  },
);

export default router;
