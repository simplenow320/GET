import { Router } from "express";
import { db, projectsTable, contentFieldsTable, projectUsersTable, activityTable, projectKeysTable } from "@workspace/db";
import { eq, and, gte, inArray, sql, isNull } from "drizzle-orm";
import { promises as dnsPromises } from "node:dns";
import net from "node:net";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateProjectBody, UpdateProjectBody } from "@workspace/api-zod";
import { ProjectName, ProjectDescription } from "../lib/validation";
import { logAudit } from "../lib/audit";
import { z } from "zod";

const router = Router();

const StrictCreateProject = z.object({
  name: ProjectName,
  description: ProjectDescription,
});
const StrictUpdateProject = z.object({
  name: ProjectName.optional(),
  description: ProjectDescription,
  status: z.enum(["draft", "active", "archived"]).optional(),
  autoPublish: z.boolean().optional(),
});

function projectToResponse(p: typeof projectsTable.$inferSelect, fieldCount = 0, clientCount = 0) {
  return {
    id: String(p.id),
    name: p.name,
    description: p.description,
    status: p.status,
    fieldCount,
    clientCount,
    lastActivityAt: p.lastActivityAt?.toISOString(),
    lastSeenAt: p.lastSeenAt?.toISOString(),
    lastSeenOrigin: p.lastSeenOrigin ?? undefined,
    autoPublish: p.autoPublish,
    createdAt: p.createdAt.toISOString(),
  };
}

// GET /stats — aggregate stats across the user's owned projects
router.get("/stats", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;
  const owned = await db.select().from(projectsTable).where(eq(projectsTable.ownerId, userId));
  const projectIds = owned.map((p) => p.id);

  if (projectIds.length === 0) {
    return res.json({
      totalProjects: 0,
      activeProjects: 0,
      totalClients: 0,
      totalFields: 0,
      recentEdits: 0,
      liveSites: 0,
    });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [clients, fields, recent] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(projectUsersTable)
      .where(inArray(projectUsersTable.projectId, projectIds)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(contentFieldsTable)
      .where(inArray(contentFieldsTable.projectId, projectIds)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(activityTable)
      .where(
        and(
          inArray(activityTable.projectId, projectIds),
          gte(activityTable.createdAt, thirtyDaysAgo),
        ),
      ),
  ]);

  // "Live" = the customer's site has fetched content in the last 24h. This is
  // the user-visible signal that the install is actually working in the wild.
  const liveSites = owned.filter(
    (p) => p.lastSeenAt && new Date(p.lastSeenAt).getTime() >= oneDayAgo.getTime(),
  ).length;

  res.json({
    totalProjects: owned.length,
    activeProjects: owned.filter((p) => p.status === "active").length,
    totalClients: clients[0]?.count ?? 0,
    totalFields: fields[0]?.count ?? 0,
    recentEdits: recent[0]?.count ?? 0,
    liveSites,
  });
});

// GET / — list all projects the user is a member of
router.get("/", requireAuth, async (req: AuthRequest, res) => {
  const userId = req.userId!;

  const memberships = await db
    .select({ projectId: projectUsersTable.projectId, role: projectUsersTable.role })
    .from(projectUsersTable)
    .where(eq(projectUsersTable.userId, userId));

  if (memberships.length === 0) return res.json([]);

  const ids = memberships.map((m) => m.projectId);
  const projects = await db.select().from(projectsTable).where(inArray(projectsTable.id, ids));
  const fieldCounts = await db
    .select({ projectId: contentFieldsTable.projectId, count: sql<number>`count(*)::int` })
    .from(contentFieldsTable)
    .where(inArray(contentFieldsTable.projectId, ids))
    .groupBy(contentFieldsTable.projectId);
  const clientCounts = await db
    .select({ projectId: projectUsersTable.projectId, count: sql<number>`count(*)::int` })
    .from(projectUsersTable)
    .where(inArray(projectUsersTable.projectId, ids))
    .groupBy(projectUsersTable.projectId);

  const fieldMap = new Map(fieldCounts.map((f) => [f.projectId, f.count]));
  const clientMap = new Map(clientCounts.map((c) => [c.projectId, c.count]));
  const roleMap = new Map(memberships.map((m) => [m.projectId, m.role]));

  const result = projects.map((p) => ({
    ...projectToResponse(p, fieldMap.get(p.id) ?? 0, clientMap.get(p.id) ?? 0),
    myRole: roleMap.get(p.id),
  }));

  res.json(result);
});

// POST / — create a new project
router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const shape = CreateProjectBody.safeParse(req.body);
  if (!shape.success) return res.status(400).json({ error: "Validation failed" });
  const parsed = StrictCreateProject.safeParse(shape.data);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
  }

  const userId = req.userId!;
  const [project] = await db
    .insert(projectsTable)
    .values({ ownerId: userId, name: parsed.data.name, description: parsed.data.description ?? null })
    .returning();

  await db.insert(projectUsersTable).values({ projectId: project.id, userId, role: "owner" });

  await logAudit({
    projectId: project.id,
    userId,
    userName: req.userName!,
    action: "created project",
  });

  res.status(201).json(projectToResponse(project, 0, 1));
});

// GET /:projectId — single project (any member)
router.get(
  "/:projectId",
  requireAuth,
  requireProjectAccess("viewer"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.projectId);
    const projects = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    const project = projects[0];
    if (!project) return res.status(404).json({ error: "Not found" });

    const [fields, clients] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contentFieldsTable)
        .where(eq(contentFieldsTable.projectId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(projectUsersTable)
        .where(eq(projectUsersTable.projectId, id)),
    ]);

    res.json({
      ...projectToResponse(project, fields[0]?.count ?? 0, clients[0]?.count ?? 0),
      myRole: req.projectRole,
    });
  },
);

// PATCH /:projectId — admin+
router.patch(
  "/:projectId",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.projectId);

    const shape = UpdateProjectBody.safeParse(req.body);
    if (!shape.success) return res.status(400).json({ error: "Validation failed" });
    const parsed = StrictUpdateProject.safeParse(shape.data);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
    }

    // The autoPublish toggle changes the trust model for client edits, so it
    // should match the UI gating (owner-only). Other fields can still be
    // edited by admins.
    if (parsed.data.autoPublish !== undefined && req.projectRole !== "owner") {
      return res.status(403).json({ error: "Only the project owner can change client publishing" });
    }

    const [updated] = await db
      .update(projectsTable)
      .set(parsed.data)
      .where(eq(projectsTable.id, id))
      .returning();
    if (!updated) return res.status(404).json({ error: "Not found" });

    await logAudit({
      projectId: id,
      userId: req.userId!,
      userName: req.userName!,
      action: "updated project",
    });

    const [fields, clients] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(contentFieldsTable)
        .where(eq(contentFieldsTable.projectId, id)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(projectUsersTable)
        .where(eq(projectUsersTable.projectId, id)),
    ]);

    res.json(projectToResponse(updated, fields[0]?.count ?? 0, clients[0]?.count ?? 0));
  },
);

// DELETE /:projectId — owner only
router.delete(
  "/:projectId",
  requireAuth,
  requireProjectAccess("owner"),
  async (req: AuthRequest, res) => {
    const id = parseInt(req.params.projectId);
    await logAudit({
      projectId: id,
      userId: req.userId!,
      userName: req.userName!,
      action: "deleted project",
    });
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    res.status(204).send();
  },
);

// POST /:projectId/install-check
//
// "Check My Setup" — fetches the client's live site server-side and reports
// in plain English what's wired and what isn't. This is the diagnostic that
// tells a user *why* their saved changes aren't showing up on the page.
//
// We look for two things in the returned HTML:
//   1. The scanner script tag (src contains scanner.js + data-key="pk_…")
//      → if missing: "Scanner not installed".
//   2. data-get-key="<Field Label>" attributes for each of the project's
//      configured fields → if missing: "Field not tagged on site".
//
// Caveats by design:
//   • We can only see the initial HTML. SPAs that render fields *after*
//     hydration won't show their tags here even though the Smart Watcher
//     will still populate them at runtime. We surface this nuance in the
//     status text ("Tag not in initial HTML — may still work in SPAs").
//   • Active key match is best-effort: we accept any non-revoked pk_ key
//     for the project; we don't need a perfect match because the scanner
//     is harmless if the key is wrong (server rejects unknown keys).
const InstallCheckBody = z.object({
  url: z.string().url().optional(),
});

router.post(
  "/:projectId/install-check",
  requireAuth,
  requireProjectAccess("editor"),
  async (req: AuthRequest, res) => {
    const projectId = parseInt(String(req.params.projectId));
    const parsed = InstallCheckBody.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid request body" });
    }

    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Resolve which URL to probe: explicit override > lastSeenOrigin.
    const siteUrl = parsed.data.url ?? project.lastSeenOrigin ?? null;

    // Always load the project's fields up-front so we can populate
    // fieldStatuses even in the no-URL fallback path. The UI relies on
    // having field labels to render the per-field health rows; sending
    // an empty array would leave the modal blank for fresh installs.
    const fieldsForFallback = !siteUrl
      ? await db
          .select({ label: contentFieldsTable.label })
          .from(contentFieldsTable)
          .where(eq(contentFieldsTable.projectId, projectId))
      : null;

    if (!siteUrl) {
      return res.json({
        siteUrl: null,
        fetched: false,
        status: 0,
        scannerFound: false,
        scannerKeyMatches: false,
        tagsFound: [] as string[],
        // Mark every field as "missing" so the UI clearly shows nothing is
        // wired yet — the user's site has never loaded our scanner.
        fieldStatuses: (fieldsForFallback ?? []).map((f) => ({
          label: f.label,
          status: "missing" as const,
        })),
        message:
          "We don't know your site URL yet. Install the scanner script and load your site once, or pass a URL.",
      });
    }

    // Load the project's active (non-revoked) keys + fields in parallel
    // with the fetch. Filtering by revokedAt IS NULL is essential —
    // revoked keys must NOT be reported as a valid scanner installation.
    const [activeKeys, fields] = await Promise.all([
      db
        .select({ keyPrefix: projectKeysTable.keyPrefix })
        .from(projectKeysTable)
        .where(
          and(
            eq(projectKeysTable.projectId, projectId),
            isNull(projectKeysTable.revokedAt),
          ),
        ),
      db
        .select({ label: contentFieldsTable.label })
        .from(contentFieldsTable)
        .where(eq(contentFieldsTable.projectId, projectId)),
    ]);
    const validPrefixes = new Set(
      activeKeys.map((k) => k.keyPrefix).filter(Boolean),
    );

    // ── SSRF defense ──────────────────────────────────────────────────
    // The user can supply an arbitrary `url` here (or stored
    // lastSeenOrigin can be tampered with). We must NEVER fetch internal
    // services, link-local metadata endpoints (169.254.169.254), or
    // private RFC1918 ranges. Strategy:
    //   • Allow only http/https, reject embedded credentials.
    //   • Resolve hostname → IPs and reject if any resolved address is
    //     loopback/private/link-local/ULA/multicast/etc. This guards
    //     against "internal-host.local" tricks.
    //   • Disable redirect following (`redirect: "manual"`) so we don't
    //     get bounced from a public host onto an internal one.
    //   • Bound body to 2MB and the whole request to 8s.
    function isPrivateAddr(ip: string): boolean {
      if (net.isIP(ip) === 0) return true;
      if (net.isIP(ip) === 4) {
        const parts = ip.split(".").map((p) => parseInt(p, 10));
        const [a, b] = parts;
        if (a === 10) return true;
        if (a === 127) return true;
        if (a === 0) return true;
        if (a === 169 && b === 254) return true; // link-local + AWS metadata
        if (a === 172 && b >= 16 && b <= 31) return true;
        if (a === 192 && b === 168) return true;
        if (a >= 224) return true; // multicast + reserved
        return false;
      }
      // IPv6
      const lower = ip.toLowerCase();
      if (lower === "::1" || lower === "::") return true;
      if (lower.startsWith("fe80:")) return true; // link-local
      if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // ULA
      if (lower.startsWith("ff")) return true; // multicast
      // IPv4-mapped (::ffff:a.b.c.d) — recurse on the embedded v4.
      const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
      if (mapped) return isPrivateAddr(mapped[1]);
      return false;
    }

    let html = "";
    let status = 0;
    let fetched = false;
    let urlError: string | null = null;
    try {
      const parsed = new URL(siteUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        urlError = `Unsupported scheme: ${parsed.protocol}`;
      } else if (parsed.username || parsed.password) {
        urlError = "URL must not contain credentials";
      } else {
        const host = parsed.hostname.replace(/^\[|\]$/g, "");
        // Reject literal private IPs immediately.
        if (net.isIP(host) !== 0) {
          if (isPrivateAddr(host)) urlError = "Address is private/internal";
        } else {
          // Resolve and reject if any A/AAAA points internal. Limits
          // DNS-rebinding by checking before the fetch — note this is
          // best-effort (a malicious resolver could return different
          // addresses to the OS), but it stops the obvious cases.
          const addrs = await dnsPromises.lookup(host, { all: true });
          if (addrs.length === 0) urlError = "DNS lookup returned no addresses";
          else if (addrs.some((a) => isPrivateAddr(a.address))) {
            urlError = "Resolves to a private/internal address";
          }
        }
      }

      if (!urlError) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 8000);
        const r = await fetch(siteUrl, {
          signal: controller.signal,
          // Don't follow redirects — a 302 to a private address would
          // bypass the pre-flight DNS check above. Surface the redirect
          // status so the user can see what happened.
          redirect: "manual",
          headers: {
            "User-Agent":
              "get-install-check/1.0 (+https://get-builder.replit.app)",
            Accept: "text/html,*/*",
          },
        });
        clearTimeout(t);
        status = r.status;
        const reader = r.body?.getReader();
        if (reader) {
          const decoder = new TextDecoder();
          let total = 0;
          const MAX = 2 * 1024 * 1024;
          try {
            while (total < MAX) {
              const { done, value } = await reader.read();
              if (done) break;
              total += value.byteLength;
              html += decoder.decode(value, { stream: true });
            }
          } finally {
            // Always release the connection — even if we hit MAX or threw,
            // we don't want to leave the socket draining in the background.
            try { await reader.cancel(); } catch { /* ignore */ }
          }
        }
        fetched = true;
      }
    } catch (err) {
      req.log.warn({ err, siteUrl }, "install-check fetch failed");
    }
    if (urlError) {
      req.log.warn({ siteUrl, urlError }, "install-check rejected URL");
    }

    // Parse: look for the scanner tag and extract its data-key.
    // Tolerant regex — any quoting style, attribute order, whitespace.
    const scannerTagRe =
      /<script\b[^>]*\bsrc\s*=\s*["'][^"']*scanner\.js[^"']*["'][^>]*>/i;
    const scannerMatch = html.match(scannerTagRe);
    const scannerFound = !!scannerMatch;

    let scannerKeyMatches = false;
    if (scannerMatch) {
      const keyAttr = scannerMatch[0].match(
        /\bdata-key\s*=\s*["']([^"']+)["']/i,
      );
      const found = keyAttr?.[1] ?? "";
      // One-way match: the key found on the site must START WITH a stored
      // non-revoked prefix. The earlier reverse-startsWith branch could
      // false-positive on short/partial values and was removed.
      for (const prefix of validPrefixes) {
        if (prefix && found.startsWith(prefix)) {
          scannerKeyMatches = true;
          break;
        }
      }
      // Courtesy fallback: if there are no active keys recorded yet (rare —
      // happens only on freshly created projects before the first key is
      // generated), surface the "tag missing" diagnostic rather than the
      // less-useful "key mismatch" one. Only triggered for plausible pk_
      // values to avoid masking the case of a totally bogus key.
      if (!scannerKeyMatches && validPrefixes.size === 0 && found.startsWith("pk_")) {
        scannerKeyMatches = true;
      }
    }

    // Collect every data-get-key value present in the served HTML.
    // We dedupe and lower-bound on length to ignore empty/garbage values.
    const tagRe = /\bdata-get-key\s*=\s*["']([^"']+)["']/gi;
    const tagsFoundSet = new Set<string>();
    let tm: RegExpExecArray | null;
    while ((tm = tagRe.exec(html)) !== null) {
      const v = tm[1].trim();
      if (v.length > 0) tagsFoundSet.add(v);
    }
    const tagsFound = Array.from(tagsFoundSet).sort();

    const fieldStatuses = fields.map((f) => ({
      label: f.label,
      status: tagsFoundSet.has(f.label) ? "wired" : "missing",
    }));

    return res.json({
      siteUrl,
      fetched,
      status,
      scannerFound,
      scannerKeyMatches,
      tagsFound,
      fieldStatuses,
    });
  },
);

export default router;
