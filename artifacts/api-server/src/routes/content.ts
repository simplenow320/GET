import { Router } from "express";
import { db, contentFieldsTable, draftsTable, domainsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireProjectAccess, AuthRequest } from "../middlewares/auth";
import { CreateContentFieldBody, UpdateContentFieldBody } from "@workspace/api-zod";
import { sanitizeContent } from "../lib/sanitize";
import { logAudit } from "../lib/audit";
import { FieldLabel, ContentValue, SelectorString, parseIdParam } from "../lib/validation";
import { z } from "zod";
import { load as cheerioLoad } from "cheerio";

const router = Router({ mergeParams: true });

const FIELD_TYPES = ["text", "richtext", "image", "url", "number", "boolean"] as const;

const StrictCreateField = z.object({
  label: FieldLabel,
  type: z.enum(FIELD_TYPES),
  selector: SelectorString,
  value: ContentValue.optional().nullable(),
});

const StrictUpdateField = z.object({
  label: FieldLabel.optional(),
  value: ContentValue.optional().nullable(),
  draftValue: ContentValue.optional().nullable(),
  isLocked: z.boolean().optional(),
});

function fieldToResponse(f: typeof contentFieldsTable.$inferSelect) {
  return {
    id: String(f.id),
    projectId: String(f.projectId),
    label: f.label,
    type: f.type,
    selector: f.selector ?? undefined,
    value: f.value ?? undefined,
    draftValue: f.draftValue ?? undefined,
    isLocked: f.isLocked,
    updatedAt: f.updatedAt?.toISOString(),
  };
}

// GET / — any member
router.get("/", requireAuth, requireProjectAccess("viewer"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));
  res.json(fields.map(fieldToResponse));
});

// POST / — admin+
router.post("/", requireAuth, requireProjectAccess("admin"), async (req: AuthRequest, res) => {
  const projectId = parseInt(req.params.projectId);
  const shape = CreateContentFieldBody.safeParse(req.body);
  if (!shape.success) return res.status(400).json({ error: "Validation failed" });
  const parsed = StrictCreateField.safeParse(shape.data);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
  }

  const [field] = await db
    .insert(contentFieldsTable)
    .values({
      projectId,
      label: parsed.data.label,
      type: parsed.data.type,
      selector: parsed.data.selector ?? null,
      value: parsed.data.value ? sanitizeContent(parsed.data.value) : null,
    })
    .returning();

  await logAudit({
    projectId,
    userId: req.userId!,
    userName: req.userName!,
    action: "added field",
    fieldLabel: field.label,
  });

  res.status(201).json(fieldToResponse(field));
});

// PATCH /:fieldId — role-split (see comments below)
router.patch(
  "/:fieldId",
  requireAuth,
  requireProjectAccess("editor"),
  async (req: AuthRequest, res) => {
    const fieldId = parseIdParam(req.params.fieldId);
    const projectId = parseInt(req.params.projectId);
    if (!fieldId) return res.status(400).json({ error: "Invalid field ID" });

    const role = req.projectRole!;
    const shape = UpdateContentFieldBody.safeParse(req.body);
    if (!shape.success) return res.status(400).json({ error: "Validation failed" });
    const parsed = StrictUpdateField.safeParse(shape.data);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Validation failed" });
    }
    const data = parsed.data;

    // Admin+ only: lock toggle, live `value`, and label changes.
    const adminOnlyChange =
      data.isLocked !== undefined || data.value !== undefined || data.label !== undefined;
    if (adminOnlyChange && !["owner", "admin"].includes(role)) {
      return res
        .status(403)
        .json({ error: "Requires admin access to change lock state, label, or live value" });
    }

    const existing = await db
      .select()
      .from(contentFieldsTable)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));
    const field = existing[0];
    if (!field) return res.status(404).json({ error: "Field not found" });

    if (field.isLocked && data.draftValue !== undefined && !["owner", "admin"].includes(role)) {
      return res.status(403).json({ error: "This field is locked" });
    }

    const updatePayload: Partial<typeof contentFieldsTable.$inferInsert> = {};
    if (data.isLocked !== undefined) updatePayload.isLocked = data.isLocked;
    if (data.label !== undefined) updatePayload.label = data.label;
    if (data.value !== undefined) updatePayload.value = data.value === null ? null : sanitizeContent(data.value);

    let sanitizedDraft: string | null = null;
    if (data.draftValue !== undefined) {
      sanitizedDraft = data.draftValue === null ? null : sanitizeContent(data.draftValue);

      const isOwnerOrAdmin = ["owner", "admin"].includes(role);

      if (sanitizedDraft !== null) {
        if (isOwnerOrAdmin) {
          // Owners and admins see their changes go live immediately — no
          // approval queue needed. We still insert a draft record for the
          // history log, but mark it published straight away.
          updatePayload.value = sanitizedDraft;
          updatePayload.draftValue = null;
          await db.insert(draftsTable).values({
            projectId,
            fieldId,
            fieldLabel: field.label,
            value: sanitizedDraft,
            authorName: req.userName!,
            status: "published",
            publishedAt: new Date(),
          });
        } else {
          // Client editors (editor / viewer role) go through the review
          // queue — the project owner approves before it goes live.
          updatePayload.draftValue = sanitizedDraft;
          await db.insert(draftsTable).values({
            projectId,
            fieldId,
            fieldLabel: field.label,
            value: sanitizedDraft,
            authorName: req.userName!,
            status: "pending",
          });
        }
      } else {
        // Explicit null clears the pending draft without changing the live value.
        updatePayload.draftValue = null;
      }
    }

    const [updated] = await db
      .update(contentFieldsTable)
      .set(updatePayload)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)))
      .returning();

    const action =
      data.draftValue !== undefined
        ? "submitted draft for"
        : data.isLocked !== undefined
          ? data.isLocked
            ? "locked field"
            : "unlocked field"
          : data.value !== undefined
            ? "updated live value"
            : "updated field";

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action,
      fieldLabel: updated.label,
      newValue: data.value ?? sanitizedDraft ?? null,
    });

    res.json(fieldToResponse(updated));
  },
);

// DELETE /:fieldId — admin+
router.delete(
  "/:fieldId",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const fieldId = parseIdParam(req.params.fieldId);
    const projectId = parseInt(req.params.projectId);
    if (!fieldId) return res.status(400).json({ error: "Invalid field ID" });

    const existing = await db
      .select()
      .from(contentFieldsTable)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));
    const field = existing[0];
    if (!field) return res.status(404).json({ error: "Field not found" });

    await db
      .delete(contentFieldsTable)
      .where(and(eq(contentFieldsTable.id, fieldId), eq(contentFieldsTable.projectId, projectId)));

    await logAudit({
      projectId,
      userId: req.userId!,
      userName: req.userName!,
      action: "deleted field",
      fieldLabel: field.label,
    });

    res.status(204).send();
  },
);

// POST /pull-from-site — admin+
// Fetch the project's connected domain, scrape visible content, and return
// per-field proposals so the owner can seed or refresh values without manually
// copy-pasting from the live site.
router.post(
  "/pull-from-site",
  requireAuth,
  requireProjectAccess("admin"),
  async (req: AuthRequest, res) => {
    const projectId = parseInt(req.params.projectId);

    const domains = await db
      .select()
      .from(domainsTable)
      .where(eq(domainsTable.projectId, projectId));

    if (domains.length === 0) {
      return res.status(400).json({
        error: "No domain connected. Add one in the Domains tab first.",
      });
    }

    const hostname = domains[0].hostname;
    const url = `https://${hostname}`;

    let html: string;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "get-cms/1.0 (+https://get-builder.replit.app)" },
      });
      clearTimeout(timer);
      if (!response.ok) {
        return res.status(400).json({
          error: `Site returned HTTP ${response.status}. Check that it's publicly accessible.`,
        });
      }
      html = await response.text();
    } catch (err: any) {
      if (err.name === "AbortError") {
        return res.status(400).json({ error: "Site took too long to respond (10 s)." });
      }
      return res.status(400).json({
        error: `Couldn't reach ${url}. Make sure the site is running and public.`,
      });
    }

    const $ = cheerioLoad(html);
    $("script, style, noscript, nav, footer, [aria-hidden='true'], [hidden]").remove();

    const headings: string[] = [];
    const paragraphs: string[] = [];
    const links: string[] = [];
    const images: string[] = [];

    $("h1, h2, h3, h4").each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, " ");
      if (t && !headings.includes(t)) headings.push(t);
    });

    $("p, li, td, th").each((_, el) => {
      const t = $(el).text().trim().replace(/\s+/g, " ");
      if (t.length > 30 && !paragraphs.includes(t)) paragraphs.push(t);
    });

    $("a[href]").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const absolute = href.startsWith("http")
        ? href
        : href.startsWith("/")
        ? `${url}${href}`
        : null;
      if (absolute && !links.includes(absolute)) links.push(absolute);
    });

    $("img[src]").each((_, el) => {
      const src = $(el).attr("src") ?? "";
      if (!src || src.startsWith("data:")) return;
      const absolute = src.startsWith("http") ? src : `${url}${src}`;
      if (!images.includes(absolute)) images.push(absolute);
    });

    const fields = await db
      .select()
      .from(contentFieldsTable)
      .where(eq(contentFieldsTable.projectId, projectId));

    // Assign scraped values to fields using independent cursors per type so
    // each field of the same type gets a different piece of content.
    let hi = 0, pi = 0, li2 = 0, ii = 0;

    const proposals = fields.map((f) => {
      let proposed: string | null = null;
      switch (f.type) {
        case "text":
          proposed = headings[hi++] ?? paragraphs[pi++] ?? null;
          break;
        case "richtext":
          proposed = [paragraphs[pi], paragraphs[pi + 1], paragraphs[pi + 2]]
            .filter(Boolean).join("\n\n") || null;
          pi += 3;
          break;
        case "url":
          proposed = links[li2++] ?? null;
          break;
        case "image":
          proposed = images[ii++] ?? null;
          break;
        default:
          proposed = null;
      }
      return {
        fieldId: String(f.id),
        fieldLabel: f.label,
        fieldType: f.type,
        current: f.value ?? null,
        proposed,
      };
    });

    res.json({ url, proposals });
  },
);

export default router;
