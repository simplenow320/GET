import crypto from "crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  projectKeysTable,
  projectsTable,
  contentFieldsTable,
  domainsTable,
} from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

// ── Origin allowlist helpers (mirror middlewares/project-key-auth.ts) ───────
// Kept in sync with requireProjectKey so that an attacker who steals a key
// cannot bypass the per-project domain allowlist by switching from the public
// REST endpoint to the MCP endpoint.
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
function normalizeAllowed(host: string): string {
  const lower = host.trim().toLowerCase();
  return lower.startsWith("www.") ? lower.slice(4) : lower;
}
function hostnameAllowed(reqHost: string, allowed: string[]): boolean {
  const r = reqHost.toLowerCase();
  for (const a of allowed) {
    if (r === a || r.endsWith("." + a)) return true;
  }
  return false;
}

// ── MCP server (JSON-RPC 2.0 over HTTP) ──────────────────────────────────────
//
// Lets any MCP-capable AI assistant (Claude Desktop, Cursor, Replit Agent,
// etc.) talk to a "get" project directly so the user doesn't have to copy
// prompts. The user adds one entry to their mcp.json with:
//   {
//     "url": "https://get-builder.replit.app/api/mcp",
//     "headers": { "Authorization": "Bearer pk_get_..." }
//   }
// — or, for clients that can't set headers, "?key=pk_get_..." in the URL.
//
// We implement the spec by hand because the protocol surface we use is tiny
// (initialize / tools/list / tools/call) and pulling in the full SDK + its
// transport layer would be heavier than the route itself.
//
// Auth model: the project key is the credential. Every method runs in the
// scope of whatever project owns the key. All tools are read-only — no write
// surface is exposed via MCP today, which keeps the security envelope small.

const router: IRouter = Router();

// ── Auth ─────────────────────────────────────────────────────────────────────

interface AuthedRequest extends Request {
  projectId?: number;
  keyPrefix?: string;
}

// Result of authenticate(): success carries the raw key so tools that
// produce install snippets can return a fully-pasteable value (the model
// usually does not see the Authorization header itself). `forbidden`
// signals an Origin-allowlist failure so the JSON-RPC layer can return a
// distinct error code from "missing/invalid key".
type AuthOk = { ok: true; projectId: number; keyPrefix: string; rawKey: string };
type AuthFail = { ok: false; reason: "unauth" | "forbidden" };
type AuthResult = AuthOk | AuthFail;

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function extractKey(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const v = header.slice(7).trim();
    if (v.length > 0) return v;
  }
  const q = (req.query.key ?? "").toString().trim();
  if (q.length > 0) return q;
  return null;
}

async function authenticate(req: AuthedRequest): Promise<AuthResult> {
  const raw = extractKey(req);
  if (!raw || !raw.startsWith("pk_")) return { ok: false, reason: "unauth" };
  const rows = await db
    .select({
      projectId: projectKeysTable.projectId,
      keyPrefix: projectKeysTable.keyPrefix,
      id: projectKeysTable.id,
    })
    .from(projectKeysTable)
    .where(
      and(
        eq(projectKeysTable.keyHash, hashKey(raw)),
        isNull(projectKeysTable.revokedAt),
      ),
    );
  const k = rows[0];
  if (!k) return { ok: false, reason: "unauth" };

  // Origin allowlist — same policy as requireProjectKey middleware:
  //   - no domains configured  → accept any origin (back-compat)
  //   - "absent" Origin/Referer → allow (server-side / cron / curl / MCP host)
  //   - "host" → must match exactly OR be a subdomain of an allowed apex
  //   - "invalid" → reject (malformed header is suspicious)
  const origin = requestOrigin(req);
  if (origin.kind !== "absent") {
    const allowedRows = await db
      .select({ hostname: domainsTable.hostname })
      .from(domainsTable)
      .where(eq(domainsTable.projectId, k.projectId));
    if (allowedRows.length > 0) {
      if (origin.kind === "invalid") {
        req.log?.warn?.(
          { projectId: k.projectId, rawOrigin: req.headers.origin, rawReferer: req.headers.referer },
          "MCP key used with malformed Origin/Referer",
        );
        return { ok: false, reason: "forbidden" };
      }
      const allowed = allowedRows.map((d) => normalizeAllowed(d.hostname));
      if (!hostnameAllowed(origin.host, allowed)) {
        req.log?.warn?.(
          { projectId: k.projectId, reqHost: origin.host, allowed },
          "MCP key used from disallowed origin",
        );
        return { ok: false, reason: "forbidden" };
      }
    }
  }

  // Best-effort lastUsedAt update — never block the response.
  void db
    .update(projectKeysTable)
    .set({ lastUsedAt: new Date() })
    .where(eq(projectKeysTable.id, k.id))
    .catch(() => {});
  return { ok: true, projectId: k.projectId, keyPrefix: k.keyPrefix, rawKey: raw };
}

// ── Tool definitions ─────────────────────────────────────────────────────────
//
// Kept intentionally small for v1. Each tool's `description` is what the
// model reads to decide when to call it — write for an LLM, not a human.

const TOOLS = [
  {
    name: "get_install_snippet",
    description:
      "Return the exact <script> tag the user must paste before </body> in their main HTML file to connect their site to the 'get' CMS. The snippet is pre-filled with the correct scanner URL and the project key. Call this first when setting up.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_list_fields",
    description:
      "List every editable content field defined for this 'get' project. Returns each field's label and type (text|richtext|image|url). Use the label as the value of the data-get-key attribute when tagging HTML elements.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_tag_instructions",
    description:
      "Get the exact rule for tagging an HTML element so 'get' can update its content. Call when the user asks how to tag elements or you are about to edit their HTML to wire up a field.",
    inputSchema: {
      type: "object",
      properties: {
        fieldLabel: {
          type: "string",
          description:
            "Optional. The label of the field you intend to tag — returned advice will reference this exact label.",
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_install_status",
    description:
      "Check whether the 'get' scanner script is currently installed on the user's live site. Returns lastSeenAt (when the scanner last contacted us), the detected site origin, and a plain-English status. Use to verify after install or when the user says their saves aren't appearing.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

// ── Tool implementations ─────────────────────────────────────────────────────

function publicBaseUrl(req: Request): string {
  // Honor the proxy headers Replit / typical reverse proxies set so we
  // emit https://your-app.replit.app instead of http://localhost when
  // serving the snippet. Falls back to req.protocol/host in dev.
  const xfProto = (req.headers["x-forwarded-proto"] || "").toString().split(",")[0].trim();
  const xfHost = (req.headers["x-forwarded-host"] || "").toString().split(",")[0].trim();
  const proto = xfProto || req.protocol || "https";
  const host = xfHost || req.get("host") || "get-builder.replit.app";
  return `${proto}://${host}`;
}

async function tool_get_install_snippet(
  req: Request,
  ctx: { projectId: number; keyPrefix: string; rawKey: string },
): Promise<{ content: { type: "text"; text: string }[] }> {
  const base = publicBaseUrl(req);
  // Embed the full raw key the caller authenticated with. MCP clients do
  // not surface the Authorization header to the model, so without this the
  // assistant would have to ask the user to paste the key — defeating the
  // "no copy-paste" goal of the tool.
  const snippet =
    `<!-- Paste just before </body> in your main HTML file. -->\n` +
    `<script\n` +
    `  src="${base}/api/public/scanner.js"\n` +
    `  data-key="${ctx.rawKey}"\n` +
    `  defer\n` +
    `></script>`;
  return {
    content: [
      {
        type: "text",
        text:
          "Install snippet for the 'get' CMS. Paste this exactly once, immediately before the closing </body> tag of the main HTML file. Do not duplicate. The data-key is already filled in with the project's key — do not modify it.\n\n" +
          snippet,
      },
    ],
  };
}

async function tool_get_list_fields(
  ctx: { projectId: number },
): Promise<{ content: { type: "text"; text: string }[] }> {
  const fields = await db
    .select({
      label: contentFieldsTable.label,
      type: contentFieldsTable.type,
    })
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, ctx.projectId));

  if (fields.length === 0) {
    return {
      content: [
        {
          type: "text",
          text:
            "This 'get' project has no content fields configured yet. Ask the user to add fields in the Content tab of their get dashboard before tagging elements.",
        },
      ],
    };
  }

  const lines = fields
    .map((f) => `  - "${f.label}" (type: ${f.type})`)
    .join("\n");
  return {
    content: [
      {
        type: "text",
        text:
          `Editable fields in this 'get' project (${fields.length} total). The label is the exact value to use as data-get-key="..." on the matching element.\n\n${lines}\n\nElement-type guidance:\n  - text → any text element (h1/h2/p/span/etc.)\n  - richtext → block element that already contains formatted HTML\n  - image → the <img> tag itself (we update its src)\n  - url → the <a> tag itself (we update its href)`,
      },
    ],
  };
}

function tool_get_tag_instructions(
  args: Record<string, unknown>,
): { content: { type: "text"; text: string }[] } {
  const label = typeof args.fieldLabel === "string" ? args.fieldLabel : null;
  const example = label
    ? `<h1 data-get-key="${label}">Current heading text</h1>`
    : `<h1 data-get-key="Hero Headline">Current heading text</h1>`;
  const labelLine = label
    ? `For the field "${label}", add this attribute to the matching element. The value MUST match the field label exactly — same spelling, same capitals, same spaces.`
    : `For each field, find the matching HTML element and add a data-get-key attribute whose value is the field label EXACTLY (same spelling, capitals, spaces).`;
  return {
    content: [
      {
        type: "text",
        text:
          `${labelLine}\n\nExample:\n  ${example}\n\nStrict rules:\n  - Add ONLY the data-get-key attribute. Do not change the element's tag, text, classes, id, styles, or other attributes.\n  - One element per field. Do not tag multiple elements with the same key.\n  - The element must be present in the initial HTML OR rendered by the framework — either is fine; the smart watcher handles SPAs.`,
      },
    ],
  };
}

async function tool_get_install_status(
  ctx: { projectId: number },
): Promise<{ content: { type: "text"; text: string }[] }> {
  const rows = await db
    .select({
      lastSeenAt: projectsTable.lastSeenAt,
      lastSeenOrigin: projectsTable.lastSeenOrigin,
      name: projectsTable.name,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, ctx.projectId));
  const p = rows[0];
  if (!p) {
    return { content: [{ type: "text", text: "Project not found." }] };
  }

  const lastSeenAt = p.lastSeenAt ? new Date(p.lastSeenAt).toISOString() : null;
  const ageMs = p.lastSeenAt ? Date.now() - new Date(p.lastSeenAt).getTime() : null;
  // 24h window is intentionally generous — for an MCP "is it installed?"
  // check, false negatives (user's site is up but they haven't loaded it
  // recently) are worse than false positives.
  const installedRecently = ageMs !== null && ageMs < 24 * 60 * 60 * 1000;

  let summary: string;
  if (!lastSeenAt) {
    summary =
      "Scanner has NEVER contacted us for this project. Either it isn't installed yet, the site has never been loaded, or the script tag is wrong. Have the user open their site in a browser, then call this tool again.";
  } else if (installedRecently) {
    summary = `Scanner is installed and active. Last contact: ${lastSeenAt} from ${p.lastSeenOrigin ?? "(origin unknown)"}.`;
  } else {
    summary = `Scanner was previously installed but hasn't contacted us recently. Last contact: ${lastSeenAt} from ${p.lastSeenOrigin ?? "(origin unknown)"}. The user's site may be down or the script may have been removed.`;
  }

  const payload = {
    project: p.name,
    lastSeenAt,
    lastSeenOrigin: p.lastSeenOrigin,
    installed: installedRecently,
    summary,
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

// ── JSON-RPC dispatcher ──────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
  return { jsonrpc: "2.0" as const, id: id ?? null, result };
}
function rpcError(id: JsonRpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } };
}

async function dispatch(
  req: Request,
  body: JsonRpcRequest,
  auth: { projectId: number; keyPrefix: string; rawKey: string },
  res: Response,
): Promise<void> {
  const { method, params, id } = body;

  // The MCP "notifications/*" methods carry no id and expect no response.
  // The spec says servers should return 202 Accepted and an empty body.
  if (method.startsWith("notifications/")) {
    res.status(202).end();
    return;
  }

  switch (method) {
    case "initialize": {
      res.json(
        rpcResult(id, {
          // Pin to a stable spec date the major clients implement. Newer
          // clients negotiate downward; older ones treat unknown methods as
          // errors which is fine because we only implement the basics.
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "get-cms", version: "1.0.0" },
        }),
      );
      return;
    }

    case "tools/list": {
      res.json(rpcResult(id, { tools: TOOLS }));
      return;
    }

    case "tools/call": {
      const name = (params?.name as string) ?? "";
      const args = (params?.arguments as Record<string, unknown>) ?? {};
      try {
        let out;
        switch (name) {
          case "get_install_snippet":
            out = await tool_get_install_snippet(req, auth);
            break;
          case "get_list_fields":
            out = await tool_get_list_fields(auth);
            break;
          case "get_tag_instructions":
            out = tool_get_tag_instructions(args);
            break;
          case "get_install_status":
            out = await tool_get_install_status(auth);
            break;
          default:
            res.json(rpcError(id, -32601, `Unknown tool: ${name}`));
            return;
        }
        res.json(rpcResult(id, out));
      } catch (err) {
        req.log.error({ err, tool: name }, "mcp tool failed");
        res.json(rpcError(id, -32603, "Tool execution failed"));
      }
      return;
    }

    case "ping":
      res.json(rpcResult(id, {}));
      return;

    default:
      res.json(rpcError(id, -32601, `Method not found: ${method}`));
      return;
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/mcp — minimal discovery page so a user pasting the URL into a
// browser sees a friendly explanation instead of "Cannot GET /api/mcp".
router.get("/", (_req, res) => {
  res
    .type("text/plain")
    .send(
      "get CMS — MCP server\n\n" +
        "POST JSON-RPC 2.0 here with:\n" +
        '  Authorization: Bearer pk_get_<your-key>   (preferred)\n' +
        "  or  ?key=pk_get_<your-key>                  (fallback)\n\n" +
        "Add the URL of this endpoint to your mcp.json.\n",
    );
});

// POST /api/mcp — JSON-RPC entry point.
router.post("/", async (req: AuthedRequest, res) => {
  const auth = await authenticate(req);
  if (!auth.ok) {
    if (auth.reason === "forbidden") {
      return res.status(403).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: -32002, message: "Origin not allowed for this project" },
      });
    }
    return res.status(401).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: "Invalid or missing project key" },
    });
  }

  const body = req.body as JsonRpcRequest | JsonRpcRequest[] | undefined;
  if (!body) {
    return res.status(400).json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32600, message: "Empty request body" },
    });
  }

  // MCP allows batched requests. Dispatch each and combine results — but
  // the dispatcher writes directly to res for the single-request path,
  // so for batches we collect responses manually.
  if (Array.isArray(body)) {
    const out: unknown[] = [];
    for (const item of body) {
      // Reuse dispatch logic by building a tiny capture-shim res.
      let captured: unknown = null;
      let statusCode = 200;
      const shim = {
        status(code: number) { statusCode = code; return shim; },
        json(payload: unknown) { captured = payload; return shim; },
        end() { captured = null; return shim; },
      } as unknown as Response;
      await dispatch(req, item, auth, shim);
      // 202 (notification) → omit from batch response per JSON-RPC spec.
      if (statusCode !== 202 && captured !== null) out.push(captured);
    }
    res.json(out);
    return;
  }

  await dispatch(req, body, auth, res);
});

export default router;
