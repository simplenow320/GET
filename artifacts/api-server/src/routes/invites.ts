import { Router } from "express";
import crypto from "crypto";
import { db, invitesTable, projectUsersTable, usersTable, projectsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateInviteBody } from "@workspace/api-zod";
import { Email, InviteRole, parseIdParam } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { sendInviteEmail } from "../lib/email";
import { buildAppUrl } from "../lib/origin";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router({ mergeParams: true });

const StrictCreateInvite = z.object({ email: Email, role: InviteRole });
const INVITE_TTL_DAYS = 7;

function generateInviteToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

function effectiveStatus(i: typeof invitesTable.$inferSelect): string {
  if (i.status === "pending" && i.expiresAt && i.expiresAt.getTime() < Date.now()) {
    return "expired";
  }
  return i.status;
}

function inviteToResponse(
  i: typeof invitesTable.$inferSelect,
  opts: { includeToken: boolean },
) {
  return {
    id: String(i.id),
    projectId: String(i.projectId),
    email: i.email,
    role: i.role,
    status: effectiveStatus(i),
    createdAt: i.createdAt.toISOString(),
    // Tokens are share-equivalent credentials — only admins see them.
    token: opts.includeToken ? i.token : null,
    expiresAt: i.expiresAt ? i.expiresAt.toISOString() : null,
  };
}

// GET / — any member; tokens only revealed to admin/owner
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const invites = await db.select().from(invitesTable).where(eq(invitesTable.projectId, projectId));
  const role = req.projectRole;
  const includeToken = role === "owner" || role === "admin";
  res.json(invites.map((i) => inviteToResponse(i, { includeToken })));
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
  // Only block on a STILL-LIVE pending invite. Expired pending rows must NOT
  // block re-invite — otherwise the owner is stuck after 7 days unless they
  // manually revoke. Treat them as effectively gone.
  const livePending = existing.some(
    (i) =>
      i.status === "pending" &&
      (!i.expiresAt || i.expiresAt.getTime() > Date.now()),
  );
  if (livePending) {
    return res.status(409).json({ error: "A pending invite already exists for this email" });
  }

  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  const [invite] = await db
    .insert(invitesTable)
    .values({ projectId, email, role: parsed.data.role, token, expiresAt })
    .returning();

  await logAudit({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action: `invited ${email} as ${parsed.data.role}`,
  });

  // Fire the invite email asynchronously — never block the response on
  // outbound mail. Look up the project name for the email subject; fall back
  // to a generic phrasing if the lookup fails.
  (async () => {
    try {
      const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
      const projectName = projects[0]?.name ?? "a project";
      // Accept URL is built from the trusted, server-configured app base URL —
      // never from request headers (those can be forged).
      const acceptUrl = buildAppUrl(`/accept-invite/${token}`);
      await sendInviteEmail({
        to: email,
        inviterName: req.userName!,
        inviterEmail: req.userEmail!,
        projectName,
        role: parsed.data.role,
        acceptUrl,
      });
    } catch (err) {
      logger.warn({ err, projectId, email }, "invite email failed");
    }
  })();

  // Admin-only POST always returns the token in the create response.
  res.status(201).json(inviteToResponse(invite, { includeToken: true }));
});

// DELETE /:inviteId — admin+; soft-revoke (token becomes unusable but row stays
// for audit + so /accept-invite/:token can render an explicit "revoked" state).
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

    if (target[0].status === "pending") {
      await db
        .update(invitesTable)
        .set({ status: "revoked" })
        .where(eq(invitesTable.id, inviteId));
    } else {
      // Already-accepted / expired / revoked rows: nothing to do, but treat as success.
    }

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
