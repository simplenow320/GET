import { Router } from "express";
import { db, activityTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const entries = await db.select().from(activityTable)
    .where(eq(activityTable.projectId, projectId))
    .orderBy(desc(activityTable.createdAt))
    .limit(50);
  res.json(entries.map(e => ({
    id: String(e.id), projectId: String(e.projectId), userId: String(e.userId),
    userName: e.userName, action: e.action, fieldLabel: e.fieldLabel ?? undefined,
    oldValue: e.oldValue ?? undefined, newValue: e.newValue ?? undefined,
    createdAt: e.createdAt.toISOString()
  })));
});

export default router;
