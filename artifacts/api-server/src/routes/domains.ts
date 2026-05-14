import { Router } from "express";
import { db, domainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { AddDomainBody } from "@workspace/api-zod";
import { Hostname, parseIdParam } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router = Router({ mergeParams: true });

const StrictAddDomain = z.object({ hostname: Hostname });

function domainToResponse(d: typeof domainsTable.$inferSelect) {
  return {
    id: String(d.id),
    projectId: String(d.projectId),
    hostname: d.hostname,
    verified: d.verified,
    createdAt: d.createdAt.toISOString(),
  };
}

// GET / — any member
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseIdParam(req.params.projectId)!;
  const domains = await db.select().from(domainsTable).where(eq(domainsTable.projectId, projectId));
  res.json(domains.map(domainToResponse));
});

// POST / — admin+
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseIdParam(req.params.projectId)!;
  const shape = AddDomainBody.safeParse(req.body);
  if (!shape.success) { res.status(400).json({ error: "Validation failed" }); return; }
  const parsed = StrictAddDomain.safeParse(shape.data);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid hostname" }); return;  }

  const hostname = parsed.data.hostname;

  // Prevent the same hostname being added to the same project twice.
  const dupe = await db
    .select()
    .from(domainsTable)
    .where(and(eq(domainsTable.projectId, projectId), eq(domainsTable.hostname, hostname)));
  if (dupe.length > 0) {
    res.status(409).json({ error: "This domain is already linked to this project" }); return;  }

  const [domain] = await db
    .insert(domainsTable)
    .values({ projectId, hostname, verified: false })
    .returning();

  await logAudit({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action: `added domain ${hostname}`,
  });

  res.status(201).json(domainToResponse(domain));
});

// DELETE /:domainId — admin+
router.delete(
  "/:domainId",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const domainId = parseIdParam(req.params.domainId);
    const projectId = parseIdParam(req.params.projectId)!;
    if (!domainId) { res.status(400).json({ error: "Invalid domain ID" }); return; }

    const target = await db
      .select()
      .from(domainsTable)
      .where(and(eq(domainsTable.id, domainId), eq(domainsTable.projectId, projectId)));
    if (!target[0]) { res.status(404).json({ error: "Domain not found" }); return; }

    await db.delete(domainsTable).where(eq(domainsTable.id, domainId));

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: `removed domain ${target[0].hostname}`,
    });

    res.status(204).send();
  },
);

export default router;
