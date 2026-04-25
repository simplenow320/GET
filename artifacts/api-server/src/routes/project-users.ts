import { Router } from "express";
import { db, projectUsersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { UpdateUserRoleBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const members = await db.select({
    id: projectUsersTable.id,
    userId: projectUsersTable.userId,
    role: projectUsersTable.role,
    joinedAt: projectUsersTable.joinedAt,
    name: usersTable.name,
    email: usersTable.email
  }).from(projectUsersTable)
    .leftJoin(usersTable, eq(projectUsersTable.userId, usersTable.id))
    .where(eq(projectUsersTable.projectId, projectId));

  res.json(members.map(m => ({
    id: String(m.id), userId: String(m.userId), name: m.name ?? "", email: m.email ?? "",
    role: m.role, joinedAt: m.joinedAt.toISOString()
  })));
});

router.patch("/:userId/role", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const userId = parseInt(req.params.userId);
  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const [updated] = await db.update(projectUsersTable)
    .set({ role: parsed.data.role })
    .where(and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, userId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  const users = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const user = users[0];
  res.json({
    id: String(updated.id), userId: String(updated.userId), name: user?.name ?? "",
    email: user?.email ?? "", role: updated.role, joinedAt: updated.joinedAt.toISOString()
  });
});

export default router;
