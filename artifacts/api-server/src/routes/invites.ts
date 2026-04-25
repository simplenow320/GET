import { Router } from "express";
import { db, invitesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateInviteBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

// GET / — any member can view invites
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const invites = await db.select().from(invitesTable).where(eq(invitesTable.projectId, projectId));
  res.json(
    invites.map(i => ({
      id: String(i.id),
      projectId: String(i.projectId),
      email: i.email,
      role: i.role,
      status: i.status,
      createdAt: i.createdAt.toISOString(),
    }))
  );
});

// POST / — admin+ can send invites
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const emailLower = parsed.data.email.toLowerCase().trim();

  // Check for duplicate pending invite
  const existing = await db
    .select()
    .from(invitesTable)
    .where(and(eq(invitesTable.projectId, projectId), eq(invitesTable.email, emailLower)));
  if (existing.some(i => i.status === "pending")) {
    return res.status(409).json({ error: "A pending invite already exists for this email" });
  }

  const [invite] = await db
    .insert(invitesTable)
    .values({ projectId, email: emailLower, role: parsed.data.role })
    .returning();

  res.status(201).json({
    id: String(invite.id),
    projectId: String(invite.projectId),
    email: invite.email,
    role: invite.role,
    status: invite.status,
    createdAt: invite.createdAt.toISOString(),
  });
});

// DELETE /:inviteId — admin+ can revoke invites
router.delete("/:inviteId", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const inviteId = parseInt(req.params.inviteId);
  const projectId = parseInt(req.params.projectId);
  await db.delete(invitesTable).where(and(eq(invitesTable.id, inviteId), eq(invitesTable.projectId, projectId)));
  res.status(204).send();
});

export default router;
