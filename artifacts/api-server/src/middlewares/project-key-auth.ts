import crypto from "crypto";
import { Request, Response, NextFunction } from "express";
import { db, projectKeysTable, domainsTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

export interface ProjectKeyRequest extends Request {
  projectId?: number;
  projectKeyId?: number;
}

function hash(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/**
 * Resolve the request's origin into one of three states so the caller can
 * distinguish a legitimate server-side fetch (no header at all) from a
 * suspicious browser request that supplied a header we couldn't parse.
 *   - { kind: "absent" }  → no Origin/Referer; SSR / cron / curl
 *   - { kind: "host", host } → parsed hostname (lowercased)
 *   - { kind: "invalid" } → header present but unparseable; treat as untrusted
 */
type OriginInfo = { kind: "absent" } | { kind: "host"; host: string } | { kind: "invalid" };
function requestOrigin(req: Request): OriginInfo {
  const raw = (req.headers.origin || req.headers.referer || "").toString().trim();
  if (!raw) return { kind: "absent" };
  try {
    return { kind: "host", host: new URL(raw).hostname.toLowerCase() };
  } catch {
    return { kind: "invalid" };
  }
}

/**
 * Normalize a stored hostname to lowercase and strip a leading "www." so
 * "www.example.com" and "example.com" are treated as the same site for the
 * apex/subdomain check below.
 */
function normalizeAllowed(host: string): string {
  const lower = host.trim().toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}

/**
 * True if the requesting hostname matches any allowed hostname exactly OR is
 * a subdomain of an allowed apex (e.g. "app.example.com" matches "example.com").
 */
function hostnameAllowed(reqHost: string, allowed: string[]): boolean {
  const r = reqHost.toLowerCase();
  for (const a of allowed) {
    if (r === a) return true;
    if (r.endsWith("." + a)) return true;
  }
  return false;
}

export async function requireProjectKey(
  req: ProjectKeyRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing project key" });
  }
  const raw = header.slice(7).trim();
  if (!raw.startsWith("pk_")) {
    return res.status(401).json({ error: "Invalid project key" });
  }
  const keyHash = hash(raw);
  const rows = await db
    .select()
    .from(projectKeysTable)
    .where(
      and(eq(projectKeysTable.keyHash, keyHash), isNull(projectKeysTable.revokedAt)),
    );
  const key = rows[0];
  if (!key) return res.status(401).json({ error: "Invalid project key" });

  // Origin allowlist enforcement.
  // Policy: if the project has zero allowed domains configured we accept the
  // request from any origin (back-compat — fresh installs are not bricked).
  // Otherwise:
  //   - "absent"  → allow (server-side fetch / SSR / cron / curl)
  //   - "host"    → must match exactly or be a subdomain of an allowed apex
  //   - "invalid" → reject; a malformed Origin/Referer is suspicious and
  //                 must not silently bypass the allowlist.
  const origin = requestOrigin(req);
  if (origin.kind !== "absent") {
    const allowedRows = await db
      .select({ hostname: domainsTable.hostname })
      .from(domainsTable)
      .where(eq(domainsTable.projectId, key.projectId));
    if (allowedRows.length > 0) {
      const allowed = allowedRows.map((d) => normalizeAllowed(d.hostname));
      if (origin.kind === "invalid") {
        req.log.warn(
          { projectId: key.projectId, rawOrigin: req.headers.origin, rawReferer: req.headers.referer },
          "project key used with malformed Origin/Referer",
        );
        return res.status(403).json({ error: "Invalid Origin header" });
      }
      if (!hostnameAllowed(origin.host, allowed)) {
        req.log.warn(
          { projectId: key.projectId, reqHost: origin.host, allowed },
          "project key used from disallowed origin",
        );
        return res.status(403).json({
          error: "Origin not allowed for this project",
          origin: origin.host,
        });
      }
    }
  }

  // Best-effort lastUsedAt update — never block the response on this
  void db
    .update(projectKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(projectKeysTable.id, key.id))
    .catch(() => {});

  req.projectId = key.projectId;
  req.projectKeyId = key.id;
  next();
  return;
}
