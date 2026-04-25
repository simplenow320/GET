import { Router } from "express";
import { db, projectUsersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { UpdateUserRoleBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

// GET / — any member
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const members = await db
    .select({
      id: projectUsersTable.id,
      userId: projectUsersTable.userId,
      role: projectUsersTable.role,
      joinedAt: projectUsersTable.joinedAt,
      name: usersTable.name,
      email: usersTable.email,
    })
    .from(projectUsersTable)
    .leftJoin(usersTable, eq(projectUsersTable.userId, usersTable.id))
    .where(eq(projectUsersTable.projectId, projectId));

  res.json(
    members.map(m => ({
      id: String(m.id),
      userId: String(m.userId),
      name: m.name ?? "",
      email: m.email ?? "",
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    }))
  );
});

// PATCH /:userId/role — owner only (can't change owner's own role)
router.patch("/:userId/role", requireAuth, requireProjectAccess("owner"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const targetUserId = parseInt(req.params.userId);
  const parsed = UpdateUserRoleBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  // Prevent changing the owner's role
  const target = await db
    .select()
    .from(projectUsersTable)
    .where(and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)));
  if (target[0]?.role === "owner") {
    return res.status(403).json({ error: "Cannot change the project owner's role" });
  }

  const [updated] = await db
    .update(projectUsersTable)
    .set({ role: parsed.data.role })
    .where(and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Member not found" });

  const users = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
  const user = users[0];
  res.json({
    id: String(updated.id),
    userId: String(updated.userId),
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: updated.role,
    joinedAt: updated.joinedAt.toISOString(),
  });
});

// DELETE /:userId — owner can remove members; members can remove themselves
router.delete("/:userId", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const targetUserId = parseInt(req.params.userId);
  const requesterId = req.userId!;
  const requesterRole = req.projectRole!;

  // Can only remove yourself OR be the owner
  if (targetUserId !== requesterId && requesterRole !== "owner") {
    return res.status(403).json({ error: "Only the project owner can remove other members" });
  }

  const target = await db
    .select()
    .from(projectUsersTable)
    .where(and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)));
  if (target[0]?.role === "owner") {
    return res.status(403).json({ error: "Cannot remove the project owner" });
  }

  await db
    .delete(projectUsersTable)
    .where(and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)));
  res.status(204).send();
});

export default router;
