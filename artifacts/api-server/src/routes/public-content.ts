import { Router, type IRouter } from "express";
import { db, contentFieldsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireProjectKey, type ProjectKeyRequest } from "../middlewares/project-key-auth";

const router: IRouter = Router();

/**
 * Public read endpoint for external customer apps. Authenticated by a project
 * key (pk_...) that scopes the request to a single project. Returns the
 * published value of every content field, keyed by label.
 *
 *   GET /api/public/content
 *   Authorization: Bearer pk_...
 *
 *   → { projectId, content: { [label]: { value, type } } }
 *
 * `value` reflects only what an admin has published — drafts are never exposed.
 */
router.get("/content", requireProjectKey, async (req: ProjectKeyRequest, res) => {
  const projectId = req.projectId!;
  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));

  const content: Record<string, { value: string | null; type: string }> = {};
  for (const f of fields) {
    content[f.label] = { value: f.value ?? null, type: f.type };
  }
  res.json({ projectId: String(projectId), content });
});

export default router;
