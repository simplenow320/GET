import { Router } from "express";
import { db, domainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middlewares/auth";
import { AddDomainBody } from "@workspace/api-zod";

const router = Router({ mergeParams: true });

router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const domains = await db.select().from(domainsTable).where(eq(domainsTable.projectId, projectId));
  res.json(domains.map(d => ({
    id: String(d.id), projectId: String(d.projectId), hostname: d.hostname,
    verified: d.verified, createdAt: d.createdAt.toISOString()
  })));
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const parsed = AddDomainBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation error" });
  const [domain] = await db.insert(domainsTable)
    .values({ projectId, hostname: parsed.data.hostname })
    .returning();
  res.status(201).json({
    id: String(domain.id), projectId: String(domain.projectId), hostname: domain.hostname,
    verified: domain.verified, createdAt: domain.createdAt.toISOString()
  });
});

router.delete("/:domainId", requireAuth, async (req: AuthRequest, res) => {
  const domainId = parseInt(req.params.domainId);
  const projectId = parseInt(req.params.projectId);
  await db.delete(domainsTable).where(and(eq(domainsTable.id, domainId), eq(domainsTable.projectId, projectId)));
  res.status(204).send();
});

export default router;
