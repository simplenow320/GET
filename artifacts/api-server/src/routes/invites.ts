import { Router } from "express";
import { db, invitesTable, projectUsersTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateInviteBody } from "@workspace/api-zod";
import { Email, InviteRole, parseIdParam } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router = Router({ mergeParams: true });

const StrictCreateInvite = z.object({ email: Email, role: InviteRole });

function inviteToResponse(i: typeof invitesTable.$inferSelect) {
  return {
    id: String(i.id),
    projectId: String(i.projectId),
    email: i.email,
    role: i.role,
    status: i.status,
    createdAt: i.createdAt.toISOString(),
  };
}

// GET / — any member
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const invites = await db.select().from(invitesTable).where(eq(invitesTable.projectId, projectId));
  res.json(invites.map(inviteToResponse));
});

// POST / — admin+
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const shape = CreateInviteBody.safeParse(req.body);
  if (!shape.success) return res.status(400).json({ error: "Validation failed" });
  const parsed = StrictCreateInvite.safeParse(shape.data);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
  }

  const email = parsed.data.email;

  // If the email already corresponds to a project member, no need to invite.
  const existingUser = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existingUser[0]) {
    const alreadyMember = await db
      .select()
      .from(projectUsersTable)
      .where(
        and(eq(projectUsersTable.projectId, projectId), eq(projectUsersTable.userId, existingUser[0].id)),
      );
    if (alreadyMember.length > 0) {
      return res.status(409).json({ error: "This person is already a member of the project" });
    }
  }

  const existing = await db
    .select()
    .from(invitesTable)
    .where(and(eq(invitesTable.projectId, projectId), eq(invitesTable.email, email)));
  if (existing.some((i) => i.status === "pending")) {
    return res.status(409).json({ error: "A pending invite already exists for this email" });
  }

  const [invite] = await db
    .insert(invitesTable)
    .values({ projectId, email, role: parsed.data.role })
    .returning();

  await logAudit({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action: `invited ${email} as ${parsed.data.role}`,
  });

  res.status(201).json(inviteToResponse(invite));
});

// DELETE /:inviteId — admin+
router.delete(
  "/:inviteId",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const inviteId = parseIdParam(req.params.inviteId);
    const projectId = parseInt(req.params.projectId);
    if (!inviteId) return res.status(400).json({ error: "Invalid invite ID" });

    const target = await db
      .select()
      .from(invitesTable)
      .where(and(eq(invitesTable.id, inviteId), eq(invitesTable.projectId, projectId)));
    if (!target[0]) return res.status(404).json({ error: "Invite not found" });

    await db.delete(invitesTable).where(eq(invitesTable.id, inviteId));

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: `revoked invite for ${target[0].email}`,
    });

    res.status(204).send();
  },
);

export default router;
