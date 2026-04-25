import { Router } from "express";
import { db, invitesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { CreateInviteBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const invites = await db.select().from(invitesTable).where(eq(invitesTable.projectId, projectId));
  res.json(invites.map(i => ({
    id: String(i.id), projectId: String(i.projectId), email: i.email,
    role: i.role, status: i.status, createdAt: i.createdAt.toISOString()
  })));
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const parsed = CreateInviteBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const [invite] = await db.insert(invitesTable)
    .values({ projectId, email: parsed.data.email, role: parsed.data.role })
    .returning();
  res.status(201).json({
    id: String(invite.id), projectId: String(invite.projectId), email: invite.email,
    role: invite.role, status: invite.status, createdAt: invite.createdAt.toISOString()
  });
});

router.delete("/:inviteId", requireAuth, async (req: AuthRequest, res) => {
  const inviteId = parseInt(req.params.inviteId);
  const projectId = parseInt(req.params.projectId);
  await db.delete(invitesTable).where(and(eq(invitesTable.id, inviteId), eq(invitesTable.projectId, projectId)));
  res.status(204).send();
});

export default router;
