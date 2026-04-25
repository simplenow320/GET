import { Router, type IRouter } from "express";
import { db, contentFieldsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireProjectKey, type ProjectKeyRequest } from "../middlewares/project-key-auth";

const router: IRouter = Router();

/**
 * Build the content response map from a list of fields.
 */
function buildContentMap(fields: typeof contentFieldsTable.$inferSelect[]) {
  const content: Record<string, { value: string | null; type: string }> = {};
  for (const f of fields) {
    content[f.label] = { value: f.value ?? null, type: f.type };
  }
  return content;
}

/**
 * GET /api/public/content
 * Simple read — returns published field values keyed by label.
 * Authenticated by a project key (pk_...).
 */
router.get("/content", requireProjectKey, async (req: ProjectKeyRequest, res) => {
  const projectId = req.projectId!;
  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));
  res.json({ projectId: String(projectId), content: buildContentMap(fields) });
});

/**
 * POST /api/public/content
 * Read + optional seed. Accepts:
 *
 *   { seed: { "Field Label": "current value in your app", … } }
 *
 * For every field whose value is still empty, the corresponding seed value is
 * stored as the live value so the client editor immediately shows real content
 * instead of a blank box. Seed is silently ignored for fields that already
 * have a value — a client edit always wins.
 *
 * Returns the same shape as GET (with seeded values reflected).
 */
router.post("/content", requireProjectKey, async (req: ProjectKeyRequest, res) => {
  const projectId = req.projectId!;

  // Parse seed — a flat { label → value } map. Non-string or missing values
  // are ignored so partial seeds are safe.
  const rawSeed = req.body?.seed;
  const seed: Record<string, string> = {};
  if (rawSeed && typeof rawSeed === "object" && !Array.isArray(rawSeed)) {
    for (const [label, val] of Object.entries(rawSeed)) {
      if (typeof val === "string" && val.trim() !== "") {
        seed[label] = val;
      }
    }
  }

  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));

  // Seed only fields that have no live value yet. We never overwrite existing
  // content (client edits always take priority over the app's hardcoded copy).
  const toSeed = fields.filter(
    (f) => (f.value == null || f.value === "") && seed[f.label] != null,
  );

  if (toSeed.length > 0) {
    await Promise.all(
      toSeed.map((f) =>
        db
          .update(contentFieldsTable)
          .set({ value: seed[f.label] })
          .where(eq(contentFieldsTable.id, f.id)),
      ),
    );
    // Reflect seeded values in the response without a second DB round-trip.
    for (const f of toSeed) {
      (f as any).value = seed[f.label];
    }
  }

  res.json({ projectId: String(projectId), content: buildContentMap(fields) });
});

export default router;
