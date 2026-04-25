import { Router } from "express";
import { db, contentFieldsTable, activityTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { CreateContentFieldBody, UpdateContentFieldBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

function fieldToResponse(f: typeof contentFieldsTable.$inferSelect) {
  return {
    id: String(f.id), projectId: String(f.projectId), label: f.label, type: f.type,
    selector: f.selector ?? undefined, value: f.value ?? undefined, draftValue: f.draftValue ?? undefined,
    isLocked: f.isLocked, updatedAt: f.updatedAt?.toISOString()
  };
}

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const fields = await db.select().from(contentFieldsTable).where(eq(contentFieldsTable.projectId, projectId));
  res.json(fields.map(fieldToResponse));
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const parsed = CreateContentFieldBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const [field] = await db.insert(contentFieldsTable)
    .values({ projectId, label: parsed.data.label, type: parsed.data.type, selector: parsed.data.selector, value: parsed.data.value })
    .returning();
  res.status(201).json(fieldToResponse(field));
});

router.patch("/:fieldId", requireAuth, async (req: AuthRequest, res) => {
  const fieldId = parseInt(req.params.fieldId);
  const projectId = parseInt(req.params.projectId);
  const parsed = UpdateContentFieldBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const [updated] = await db.update(contentFieldsTable)
    .set(parsed.data)
    .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  if (parsed.data.value !== undefined) {
    await db.insert(activityTable).values({
      projectId, userId: req.userId!, userName: req.userName!,
      action: "updated", fieldLabel: updated.label,
      newValue: parsed.data.value
    });
  }
  res.json(fieldToResponse(updated));
});

router.delete("/:fieldId", requireAuth, async (req: AuthRequest, res) => {
  const fieldId = parseInt(req.params.fieldId);
  const projectId = parseInt(req.params.projectId);
  await db.delete(contentFieldsTable)
    .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));
  res.status(204).send();
});

export default router;
