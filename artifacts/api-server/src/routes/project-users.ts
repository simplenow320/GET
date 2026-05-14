import { Router } from "express";
import { db, projectUsersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { UpdateUserRoleBody } from "@workspace/api-zod";
import { ManageableRole, parseIdParam } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router = Router({ mergeParams: true });

const StrictUpdateRole = z.object({ role: ManageableRole });

function memberToResponse(m: {
  id: number;
  userId: number;
  role: string;
  joinedAt: Date;
  name: string | null;
  email: string | null;
}) {
  return {
    id: String(m.id),
    userId: String(m.userId),
    name: m.name ?? "",
    email: m.email ?? "",
    role: m.role,
    joinedAt: m.joinedAt.toISOString(),
  };
}

// GET / — any member
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseIdParam(req.params.projectId)!;
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

  res.json(members.map(memberToResponse));
});

// PATCH /:userId/role — owner only. Cannot change owner's role nor promote anyone to owner.
router.patch(
  "/:userId/role",
  requireAuth,
  requireProjectAccess("owner"),
  async (req: AuthRequest, res) => {
    const projectId = parseIdParam(req.params.projectId)!;
    const targetUserId = parseIdParam(req.params.userId);
    if (!targetUserId) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const shape = UpdateUserRoleBody.safeParse(req.body);
    if (!shape.success) { res.status(400).json({ error: "Validation failed" }); return; }
    const parsed = StrictUpdateRole.safeParse(shape.data);
    if (!parsed.success) {
      res.status(400).json({ error: "Role must be admin, editor, or viewer" }); return;    }

    const target = await db
      .select()
      .from(projectUsersTable)
      .where(
        and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)),
      );
    if (!target[0]) { res.status(404).json({ error: "Member not found" }); return; }
    if (target[0].role === "owner") {
      res.status(403).json({ error: "Cannot change the project owner's role" }); return;    }

    const [updated] = await db
      .update(projectUsersTable)
      .set({ role: parsed.data.role })
      .where(
        and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)),
      )
      .returning();

    const users = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
    const user = users[0];

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: `set role to ${parsed.data.role} for ${user?.email ?? `user ${targetUserId}`}`,
    });

    res.json(
      memberToResponse({
        id: updated.id,
        userId: updated.userId,
        role: updated.role,
        joinedAt: updated.joinedAt,
        name: user?.name ?? "",
        email: user?.email ?? "",
      }),
    );
  },
);

// DELETE /:userId — owner can remove anyone (except themselves), members can remove themselves
router.delete(
  "/:userId",
  requireAuth,
  requireProjectAccess("viewer"),
  async (req: AuthRequest, res) => {
    const projectId = parseIdParam(req.params.projectId)!;
    const targetUserId = parseIdParam(req.params.userId);
    if (!targetUserId) { res.status(400).json({ error: "Invalid user ID" }); return; }

    const requesterId = req.userId!;
    const requesterRole = req.projectRole!;

    if (targetUserId !== requesterId && requesterRole !== "owner") {
      res.status(403).json({ error: "Only the project owner can remove other members" }); return;    }

    const target = await db
      .select()
      .from(projectUsersTable)
      .where(
        and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)),
      );
    if (!target[0]) { res.status(404).json({ error: "Member not found" }); return; }
    if (target[0].role === "owner") {
      res.status(403).json({ error: "Cannot remove the project owner" }); return;    }

    const users = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
    const targetEmail = users[0]?.email ?? `user ${targetUserId}`;

    await db
      .delete(projectUsersTable)
      .where(
        and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, targetUserId)),
      );

    await logAudit({
      projectId,
      userId: requesterId,
      userName: req.userName!,
      action:
        targetUserId === requesterId ? `left the project` : `removed member ${targetEmail}`,
    });

    res.status(204).send();
  },
);

export default router;
