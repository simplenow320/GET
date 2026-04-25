import { Router } from "express";
import { db, domainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { AddDomainBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

function domainToResponse(d: typeof domainsTable.$inferSelect) {
  return {
    id: String(d.id),
    projectId: String(d.projectId),
    hostname: d.hostname,
    verified: d.verified,
    createdAt: d.createdAt.toISOString(),
  };
}

// GET / — any member can view domains
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const domains = await db.select().from(domainsTable).where(eq(domainsTable.projectId, projectId));
  res.json(domains.map(domainToResponse));
});

// POST / — admin+ only
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const parsed = AddDomainBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  // Normalize hostname
  let hostname = parsed.data.hostname.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0];

  const [domain] = await db.insert(domainsTable).values({ projectId, hostname }).returning();
  res.status(201).json(domainToResponse(domain));
});

// DELETE /:domainId — admin+ only
router.delete("/:domainId", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const domainId = parseInt(req.params.domainId);
  const projectId = parseInt(req.params.projectId);
  await db
    .delete(domainsTable)
    .where(and(eq(domainsTable.id, domainId), eq(domainsTable.projectId, projectId)));
  res.status(204).send();
});

export default router;
