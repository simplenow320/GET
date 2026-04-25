import { Router } from "express";
import crypto from "crypto";
import { db, invitesTable, projectUsersTable, projectsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { logAudit } from "../lib/audit";

const router = Router();

const TOKEN_RE = /^[a-f0-9]{32,128}$/i;

/**
 * Hash a raw invite token to match the format we store in `invites.token`
 * (SHA-256 hex). The raw token only ever exists in the email link / the
 * one-time create response; everything DB-side is the hash.
 */
function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function isExpired(invite: { expiresAt: Date | null; status: string }): boolean {
  if (invite.status !== "pending") return false;
  if (!invite.expiresAt) return false;
  return invite.expiresAt.getTime() < Date.now();
}

router.get("/:token", async (req, res) => {
  // Tokens are hex; normalize case so a copied link with mixed case still works.
  const raw = String(req.params.token || "").toLowerCase();
  if (!TOKEN_RE.test(raw)) {
    return res.status(404).json({ error: "Invite not found" });
  }

  const tokenHash = hashToken(raw);
  const rows = await db.select().from(invitesTable).where(eq(invitesTable.tokenHash, tokenHash));
  const invite = rows[0];
  if (!invite) return res.status(404).json({ error: "Invite not found" });

  const projects = await db
    .select({ id: projectsTable.id, name: projectsTable.name })
    .from(projectsTable)
    .where(eq(projectsTable.id, invite.projectId));
  const project = projects[0];

  let status: "pending" | "accepted" | "expired" | "revoked" = invite.status as any;
  if (status === "pending" && isExpired(invite)) status = "expired";

  res.json({
    email: invite.email,
    role: invite.role,
    status,
    projectName: project?.name ?? "this project",
    expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
  });
});

router.post("/:token/accept", requireAuth, async (req: AuthRequest, res) => {
  const raw = String(req.params.token || "").toLowerCase();
  if (!TOKEN_RE.test(raw)) return res.status(404).json({ error: "Invite not found" });
  const tokenHash = hashToken(raw);

  // First read (outside txn) so we can return the right user-facing error before
  // attempting the consume. The actual consume below is atomic and re-validates.
  const preRows = await db.select().from(invitesTable).where(eq(invitesTable.tokenHash, tokenHash));
  const pre = preRows[0];
  if (!pre) return res.status(404).json({ error: "Invite not found" });

  // Email match must happen before consume (single-use semantics — we don't want
  // to burn a token if the wrong account is logged in).
  const userEmail = (req.userEmail || "").toLowerCase();
  if (pre.email.toLowerCase() !== userEmail) {
    return res.status(403).json({
      error: `This invite is for ${pre.email}. Sign in with that account to accept.`,
    });
  }

  // Idempotent: if this user is already a member, return success without burning
  // anything new. This handles "already accepted by me" without a confusing error.
  const userId = req.userId!;
  const alreadyMember = await db
    .select()
    .from(projectUsersTable)
    .where(
      and(
        eq(projectUsersTable.projectId, pre.projectId),
        eq(projectUsersTable.userId, userId),
      ),
    );
  if (alreadyMember.length > 0) {
    return res.json({
      projectId: String(pre.projectId),
      role: alreadyMember[0].role,
      alreadyMember: true,
    });
  }

  // Terminal states (accepted/revoked/expired) — bail before consuming.
  if (pre.status === "accepted") {
    return res.status(409).json({ error: "This invite has already been used" });
  }
  if (pre.status === "revoked") {
    return res.status(409).json({ error: "This invite has been revoked" });
  }
  if (pre.status === "expired" || isExpired(pre)) {
    return res.status(409).json({ error: "This invite has expired" });
  }

  // Atomic consume: single conditional UPDATE that flips pending → accepted only
  // if it's still pending and not expired. Then insert membership in same txn.
  // If anyone else (admin revoke, concurrent accept) mutated the row in between,
  // the UPDATE returns 0 rows and we abort.
  try {
    const result = await db.transaction(async (tx) => {
      const consumed = await tx
        .update(invitesTable)
        .set({ status: "accepted" })
        .where(
          and(
            eq(invitesTable.id, pre.id),
            eq(invitesTable.status, "pending"),
            // expires_at IS NULL OR expires_at > now()
            sql`(${invitesTable.expiresAt} IS NULL OR ${invitesTable.expiresAt} > now())`,
          ),
        )
        .returning();

      if (consumed.length === 0) {
        return { ok: false as const };
      }

      // Composite unique on (project_id, user_id) makes this safe against races.
      await tx
        .insert(projectUsersTable)
        .values({
          projectId: pre.projectId,
          userId,
          role: pre.role,
        })
        .onConflictDoNothing();

      return { ok: true as const, role: pre.role, projectId: pre.projectId };
    });

    if (!result.ok) {
      // Race-safe idempotency: if the invite was consumed between our pre-check
      // and our UPDATE by THIS same user (e.g. duplicate-clicks, concurrent tabs),
      // they're now a member — return success with alreadyMember instead of 409.
      const nowMember = await db
        .select()
        .from(projectUsersTable)
        .where(
          and(
            eq(projectUsersTable.projectId, pre.projectId),
            eq(projectUsersTable.userId, userId),
          ),
        );
      if (nowMember.length > 0) {
        return res.json({
          projectId: String(pre.projectId),
          role: nowMember[0].role,
          alreadyMember: true,
        });
      }

      // Otherwise, surface the real terminal state.
      const after = (await db.select().from(invitesTable).where(eq(invitesTable.id, pre.id)))[0];
      if (!after) return res.status(404).json({ error: "Invite not found" });
      if (after.status === "accepted") {
        return res.status(409).json({ error: "This invite has already been used" });
      }
      if (after.status === "revoked") {
        return res.status(409).json({ error: "This invite has been revoked" });
      }
      if (after.status === "pending" && isExpired(after)) {
        return res.status(409).json({ error: "This invite has expired" });
      }
      return res.status(409).json({ error: "This invite is no longer valid" });
    }

    await logAudit({
      projectId: result.projectId,
      userId,
      userName: req.userName || pre.email,
      action: `accepted invite as ${result.role}`,
    });

    return res.json({
      projectId: String(result.projectId),
      role: result.role,
    });
  } catch (err: any) {
    // Defensive: surface anything unexpected without leaking internals.
    return res.status(500).json({ error: "Could not accept invite. Please try again." });
  }
});

export default router;
