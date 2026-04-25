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
// Fetch the project's connected domain, scan the page into named sections,
// and return proposed fields (label + type + value) for the owner to import.
// Creates NEW fields — does not require any existing content map.
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
      const timer = setTimeout(() => controller.abort(), 12_000);
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
        return res.status(400).json({ error: "Site took too long to respond (12 s)." });
      }
      return res.status(400).json({
        error: `Couldn't reach ${url}. Make sure the site is running and public.`,
      });
    }

    const $ = cheerioLoad(html);

    // Strip non-content noise
    $("script, style, noscript, iframe, [aria-hidden='true'], [hidden], template").remove();

    // ── Helpers ─────────────────────────────────────────────────────────────

    function cleanText(raw: string) {
      return raw.replace(/\s+/g, " ").trim();
    }

    function absoluteUrl(src: string) {
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) return null;
      if (src.startsWith("http://") || src.startsWith("https://")) return src;
      if (src.startsWith("//")) return `https:${src}`;
      if (src.startsWith("/")) return `${url}${src}`;
      return `${url}/${src}`;
    }

    // Known section-name keywords pulled from common class/id patterns
    const SECTION_KEYWORDS: Record<string, string> = {
      hero: "Hero", banner: "Hero", jumbotron: "Hero",
      about: "About", story: "About", mission: "About",
      services: "Services", features: "Features", offerings: "Services",
      how: "How It Works", process: "How It Works", steps: "How It Works",
      team: "Team", staff: "Team", people: "Team",
      testimonial: "Testimonials", reviews: "Testimonials", clients: "Testimonials",
      pricing: "Pricing", plans: "Pricing",
      faq: "FAQ", questions: "FAQ",
      contact: "Contact", "get-in-touch": "Contact",
      cta: "Call to Action", "call-to-action": "Call to Action",
      footer: "Footer",
    };

    function inferNameFromEl(el: ReturnType<typeof $>[0]): string | null {
      const id = ($(el).attr("id") ?? "").toLowerCase();
      const cls = ($(el).attr("class") ?? "").toLowerCase();
      const ariaLabel = $(el).attr("aria-label") ?? "";
      if (ariaLabel) return ariaLabel;
      for (const [kw, name] of Object.entries(SECTION_KEYWORDS)) {
        if (id.includes(kw) || cls.includes(kw)) return name;
      }
      return null;
    }

    // ── Section extraction ───────────────────────────────────────────────────

    type ScrapedField = { label: string; type: string; value: string };
    type ScrapedSection = { name: string; fields: ScrapedField[] };

    const seenText = new Set<string>();
    const seenImages = new Set<string>();
    const sections: ScrapedSection[] = [];

    function extractSection(el: ReturnType<typeof $>[0], fallbackName: string) {
      const $el = $(el);
      const fields: ScrapedField[] = [];

      // Heading
      const headingEl = $el.find("h1, h2, h3, h4").first();
      const headingText = cleanText(headingEl.text());
      if (headingText && headingText.length <= 200 && !seenText.has(headingText)) {
        seenText.add(headingText);
        fields.push({ label: `${fallbackName} Heading`, type: "text", value: headingText });
      }

      // Sub-heading (h3/h4 after the primary heading)
      const subHeadingEl = $el.find("h3, h4").not(headingEl[0]).first();
      const subText = cleanText(subHeadingEl.text());
      if (subText && subText !== headingText && subText.length <= 200 && !seenText.has(subText)) {
        seenText.add(subText);
        fields.push({ label: `${fallbackName} Sub-heading`, type: "text", value: subText });
      }

      // Body paragraphs — collect all, join into richtext
      const bodyParts: string[] = [];
      $el.find("p").each((_, p) => {
        const t = cleanText($(p).text());
        if (t.length >= 20 && !seenText.has(t)) {
          seenText.add(t);
          bodyParts.push(t);
        }
      });
      if (bodyParts.length > 0) {
        const joined = bodyParts.join("\n\n");
        fields.push({ label: `${fallbackName} Body`, type: "richtext", value: joined });
      }

      // CTA — button or prominent link
      const ctaEl = $el.find("a[href], button").filter((_, a) => {
        const t = cleanText($(a).text());
        return t.length >= 2 && t.length <= 60;
      }).first();
      if (ctaEl.length) {
        const href = ctaEl.attr("href") ?? "";
        const abs = absoluteUrl(href);
        if (abs && !abs.includes("#") && !seenText.has(abs)) {
          seenText.add(abs);
          const ctaLabel = `${fallbackName} CTA`;
          fields.push({ label: ctaLabel, type: "url", value: abs });
        }
      }

      // Image
      $el.find("img[src]").each((_, img) => {
        const src = absoluteUrl($(img).attr("src") ?? "");
        if (src && !seenImages.has(src)) {
          seenImages.add(src);
          fields.push({ label: `${fallbackName} Image`, type: "image", value: src });
          return false; // only first image per section
        }
      });

      return fields;
    }

    // Primary pass: semantic / named sections
    const sectionEls = $("section, article, [class*='section'], [class*='block'], [id]")
      .toArray()
      // skip deeply nested ones — only top-level-ish containers
      .filter((el) => {
        const depth = $(el).parents("section, article").length;
        return depth <= 1;
      });

    const usedNames = new Map<string, number>();

    for (const el of sectionEls) {
      let name = inferNameFromEl(el);
      if (!name) {
        // Try to derive from first heading inside
        const h = $(el).find("h1, h2, h3").first().text().trim();
        if (h && h.length <= 60) name = h;
      }
      if (!name) continue; // skip unidentifiable containers

      // Deduplicate section names with a counter
      const count = usedNames.get(name) ?? 0;
      usedNames.set(name, count + 1);
      const displayName = count === 0 ? name : `${name} ${count + 1}`;

      const fields = extractSection(el, displayName);
      if (fields.length > 0) {
        sections.push({ name: displayName, fields });
      }
      if (sections.length >= 10) break; // cap at 10 sections
    }

    // Fallback pass: if we found nothing, scrape page body in flat sections
    if (sections.length === 0) {
      $("nav, footer, header").remove();
      const allHeadings = $("h1, h2, h3").toArray();
      for (const hEl of allHeadings) {
        const headingText = cleanText($(hEl).text());
        if (!headingText || headingText.length > 200 || seenText.has(headingText)) continue;
        seenText.add(headingText);

        const name = headingText.length <= 40 ? headingText : headingText.slice(0, 40) + "…";
        const fields: ScrapedField[] = [
          { label: `${name} Heading`, type: "text", value: headingText },
        ];

        // Collect following sibling paragraphs until next heading
        const bodyParts: string[] = [];
        let sib = $(hEl).next();
        let limit = 5;
        while (sib.length && limit-- > 0) {
          if (sib.is("h1, h2, h3, h4")) break;
          const t = cleanText(sib.text());
          if (t.length >= 20 && !seenText.has(t)) {
            seenText.add(t);
            bodyParts.push(t);
          }
          sib = sib.next();
        }
        if (bodyParts.length) fields.push({ label: `${name} Body`, type: "richtext", value: bodyParts.join("\n\n") });

        sections.push({ name, fields });
        if (sections.length >= 8) break;
      }
    }

    // Last resort: at least pull the page title + meta description
    if (sections.length === 0) {
      const title = cleanText($("title").text());
      const meta = $("meta[name='description']").attr("content") ?? "";
      const fields: ScrapedField[] = [];
      if (title) fields.push({ label: "Page Title", type: "text", value: title });
      if (meta) fields.push({ label: "Page Description", type: "richtext", value: cleanText(meta) });
      if (fields.length) sections.push({ name: "Page", fields });
    }

    res.json({ url, sections });
  },
);

export default router;
