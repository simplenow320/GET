import { Router } from "express";
import { db, contentFieldsTable, activityTable, draftsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateContentFieldBody, UpdateContentFieldBody } from "@workspace/api-zod";
import { sanitizeContent } from "../lib/sanitize";

const router = Router({ mergeParams: true });

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

// GET / — any project member can view fields
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const fields = await db.select().from(contentFieldsTable).where(eq(contentFieldsTable.projectId, projectId));
  res.json(fields.map(fieldToResponse));
});

// POST / — admin+ can add new fields
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const parsed = CreateContentFieldBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const [field] = await db
    .insert(contentFieldsTable)
    .values({
      projectId,
      label: parsed.data.label.trim(),
      type: parsed.data.type,
      selector: parsed.data.selector,
      value: parsed.data.value ? sanitizeContent(parsed.data.value) : undefined,
    })
    .returning();

  await db.insert(activityTable).values({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action: "added field",
    fieldLabel: field.label,
    newValue: null,
  });

  res.status(201).json(fieldToResponse(field));
});

// PATCH /:fieldId — role-split:
//   - isLocked toggle: admin+ only
//   - value (publish value): admin+ only
//   - draftValue: editor+, creates a Draft record, never writes directly to value
router.patch("/:fieldId", requireAuth, requireProjectAccess("editor"), async (req: AuthRequest, res) => {
  const fieldId = parseInt(req.params.fieldId);
  const projectId = parseInt(req.params.projectId);
  const role = req.projectRole!;

  const parsed = UpdateContentFieldBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const data = parsed.data;

  // Only admin+ can lock/unlock or set the live value directly
  if ((data.isLocked !== undefined || data.value !== undefined) && !["owner", "admin"].includes(role)) {
    return res.status(403).json({ error: "Requires admin access to change lock state or live value" });
  }

  // Check field exists in this project
  const existing = await db
    .select()
    .from(contentFieldsTable)
    .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));
  const field = existing[0];
  if (!field) return res.status(404).json({ error: "Field not found" });

  if (field.isLocked && data.draftValue !== undefined && !["owner", "admin"].includes(role)) {
    return res.status(403).json({ error: "This field is locked" });
  }

  // Build update payload
  const updatePayload: Partial<typeof contentFieldsTable.$inferInsert> = {};

  if (data.isLocked !== undefined) updatePayload.isLocked = data.isLocked;
  if (data.label !== undefined) updatePayload.label = data.label.trim();

  // Sanitize any incoming text values
  if (data.value !== undefined) {
    updatePayload.value = sanitizeContent(data.value);
  }

  if (data.draftValue !== undefined) {
    const sanitized = sanitizeContent(data.draftValue);
    updatePayload.draftValue = sanitized;

    // Auto-create a Draft record so the owner can review and publish
    await db.insert(draftsTable).values({
      projectId,
      fieldId,
      fieldLabel: field.label,
      value: sanitized,
      authorName: req.userName!,
      status: "pending",
    });
  }

  const [updated] = await db
    .update(contentFieldsTable)
    .set(updatePayload)
    .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)))
    .returning();

  // Log the activity
  const action = data.draftValue !== undefined
    ? "submitted draft for"
    : data.isLocked !== undefined
    ? (data.isLocked ? "locked field" : "unlocked field")
    : "updated";

  await db.insert(activityTable).values({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action,
    fieldLabel: updated.label,
    newValue: data.value ?? data.draftValue ?? null,
  });

  res.json(fieldToResponse(updated));
});

// DELETE /:fieldId — admin+ only
router.delete("/:fieldId", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const fieldId = parseInt(req.params.fieldId);
  const projectId = parseInt(req.params.projectId);
  await db
    .delete(contentFieldsTable)
    .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));
  res.status(204).send();
});

export default router;
