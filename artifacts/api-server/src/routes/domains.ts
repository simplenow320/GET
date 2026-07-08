import { Router } from "express";
import { db, domainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { promises as dnsPromises } from "node:dns";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { AddDomainBody } from "@workspace/api-zod";
import { Hostname, parseIdParam } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { guardedFetch } from "../lib/guarded-fetch";
import { z } from "zod";

const router = Router({ mergeParams: true });

const StrictAddDomain = z.object({ hostname: Hostname });

function domainToResponse(d: typeof domainsTable.$inferSelect) {
  return {
    id: String(d.id),
    projectId: String(d.projectId),
    hostname: d.hostname,
    verified: d.verified,
    lastCheckedAt: d.lastCheckedAt?.toISOString() ?? null,
    lastCheckError: d.lastCheckError,
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

// POST /:domainId/verify — admin+
//
// Confirms a domain is actually live before showing it as "Verified": first a
// DNS lookup (catches typos and domains that were never pointed anywhere),
// then a guarded HTTP(S) request to confirm something answers. Any HTTP
// response — even a 404 — counts as "reachable", since we're checking that a
// web server is there, not that this specific project is served from it.
router.post(
  "/:domainId/verify",
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

    const hostname = target[0].hostname;

    let dnsError: string | null = null;
    try {
      const addrs = await dnsPromises.lookup(hostname, { all: true });
      if (addrs.length === 0) dnsError = "DNS lookup returned no addresses";
    } catch {
      dnsError = `Couldn't resolve ${hostname} — check the domain is spelled correctly and has a DNS record`;
    }

    let reachable = false;
    let checkError: string | null = dnsError;
    if (!dnsError) {
      // Try https first (the common case), then fall back to http — plenty
      // of client sites don't have a redirect set up yet.
      const https = await guardedFetch(`https://${hostname}/`, {
        userAgent: "get-domain-verify/1.0 (+https://get-builder.replit.app)",
        maxBytes: 1024,
        timeoutMs: 6000,
      });
      if (https.fetched) {
        reachable = true;
      } else {
        const http = await guardedFetch(`http://${hostname}/`, {
          userAgent: "get-domain-verify/1.0 (+https://get-builder.replit.app)",
          maxBytes: 1024,
          timeoutMs: 6000,
        });
        if (http.fetched) {
          reachable = true;
        } else {
          checkError = http.urlError ?? https.urlError ?? "Site didn't respond";
        }
      }
    }

    const [updated] = await db
      .update(domainsTable)
      .set({
        verified: reachable,
        lastCheckedAt: new Date(),
        lastCheckError: reachable ? null : checkError,
      })
      .where(eq(domainsTable.id, domainId))
      .returning();

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: reachable ? `verified domain ${hostname}` : `verification failed for domain ${hostname}`,
    });

    res.json(domainToResponse(updated));
  },
);

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
