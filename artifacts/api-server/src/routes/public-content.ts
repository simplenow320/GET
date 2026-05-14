import { Router, type IRouter, type Request } from "express";
import { z } from "zod";
import { db, contentFieldsTable, contentSnapshotsTable, projectsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireProjectKey, type ProjectKeyRequest } from "../middlewares/project-key-auth";
import { sanitizeContent, sanitizeRichContent } from "../lib/sanitize";

const router: IRouter = Router();

// ── Public-write hardening (audit critical #1 + medium #5) ──────────────────
//
// The pk_ project key authenticating these endpoints lives in plaintext in
// the customer's HTML — anyone who can `view-source:` the site has it. So the
// "auth" here is really only "you are SOMEWHERE on the open internet". Every
// write path below therefore treats the body as fully untrusted: validated
// with Zod, capped, sanitized per field type, and never stored verbatim.
//
// In particular, richtext seeds previously hit the DB with whatever HTML the
// caller sent — and the scanner later re-hydrated those values via
// `innerHTML`. That is stored XSS. sanitizeForType() below mirrors the
// authenticated /api/projects/:id/content route's treatment so the public
// surface can never become a soft underbelly.

/** Hard limits applied to any public-write payload. Generous for legit use,
 *  small enough to bound abuse cost. */
const MAX_SEED_FIELDS = 200;
const MAX_SEED_VALUE_LEN = 10_000;
const MAX_SNAPSHOT_SECTIONS = 50;
const MAX_SNAPSHOT_FIELDS_PER_SECTION = 200;
const MAX_SNAPSHOT_VALUE_LEN = 10_000;
const MAX_PAGE_URL_LEN = 2048;

/** Choose the right sanitizer for a given field type — richtext keeps a safe
 *  HTML allowlist; everything else gets stripped to plain text. */
function sanitizeForType(value: string, type: string): string {
  return type === "richtext" ? sanitizeRichContent(value) : sanitizeContent(value);
}

/** Strip a caller-supplied page URL down to scheme://host[:port]/path — drops
 *  query strings (which routinely carry session ids / tokens / PII) and any
 *  fragment. Returns null on anything unparseable. */
function safePageUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_PAGE_URL_LEN) return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return (u.origin + u.pathname).slice(0, MAX_PAGE_URL_LEN);
  } catch {
    return null;
  }
}

const SeedBody = z.object({
  seed: z
    .record(z.string().min(1).max(120), z.string().max(MAX_SEED_VALUE_LEN))
    .refine(
      (rec) => Object.keys(rec).length <= MAX_SEED_FIELDS,
      `Too many seed fields (max ${MAX_SEED_FIELDS})`,
    )
    .optional(),
});

// A snapshot section as the scanner posts it. Unknown fields are stripped
// rather than rejected so older scanner versions don't break on schema drift.
const SnapshotField = z
  .object({
    label: z.string().min(1).max(120),
    type: z.string().max(40),
    value: z.string().max(MAX_SNAPSHOT_VALUE_LEN).optional().nullable(),
    selector: z.string().max(500).optional().nullable(),
  })
  .passthrough();
const SnapshotSection = z
  .object({
    title: z.string().max(200).optional().nullable(),
    fields: z.array(SnapshotField).max(MAX_SNAPSHOT_FIELDS_PER_SECTION),
  })
  .passthrough();
const SnapshotBody = z.object({
  sections: z.array(SnapshotSection).min(1).max(MAX_SNAPSHOT_SECTIONS),
  pageUrl: z.string().max(MAX_PAGE_URL_LEN).optional().nullable(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildContentMap(fields: typeof contentFieldsTable.$inferSelect[]) {
  const content: Record<string, { value: string | null; type: string }> = {};
  for (const f of fields) {
    content[f.label] = { value: f.value ?? null, type: f.type };
  }
  return content;
}

/**
 * Record that the customer's site (script tag) just contacted us. Powers the
 * dashboard "Last seen" badge so an owner can tell at a glance whether the
 * install is alive. Never throws — if the write fails we still serve the read.
 *
 * Privacy: we deliberately store ONLY the URL origin (scheme://host[:port]),
 * never the full path or query string. The Referer header can leak path-level
 * data such as session ids or filter params; clamping to origin avoids that.
 */
function safeOrigin(req: Request): string | null {
  const raw = (req.headers.origin || req.headers.referer || "").toString().trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // Only keep scheme + host + (non-default) port. Drop path, query, hash.
    return u.origin.slice(0, 256);
  } catch {
    return null;
  }
}

function recordPing(projectId: number, req: Request): void {
  const origin = safeOrigin(req);
  db.update(projectsTable)
    .set({ lastSeenAt: new Date(), lastSeenOrigin: origin })
    .where(eq(projectsTable.id, projectId))
    .catch((err: unknown) => {
      req.log.warn({ err, projectId }, "failed to record project ping");
    });
}

// ── Content endpoints ─────────────────────────────────────────────────────────

/**
 * GET /api/public/content
 * Simple read — returns published field values keyed by label.
 */
router.get("/content", requireProjectKey, async (req: ProjectKeyRequest, res) => {
  const projectId = req.projectId!;
  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));
  recordPing(projectId, req);
  res.json({ projectId: String(projectId), content: buildContentMap(fields) });
});

/**
 * POST /api/public/content
 * Read + optional seed. Seeds empty fields with provided values so the
 * client editor shows real content immediately. Seed never overwrites a
 * value that was already set by a client edit.
 */
router.post("/content", requireProjectKey, async (req: ProjectKeyRequest, res) => {
  const projectId = req.projectId!;

  // Validate first — caller is effectively anonymous (their pk_ is in their
  // public HTML), so we treat the body as hostile until proven otherwise.
  const parsed = SeedBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid request body" });
  }
  const rawSeed = parsed.data.seed ?? {};

  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));

  // Only seed fields that (a) were declared by the project owner, (b) are
  // still empty, and (c) have a non-empty seed value supplied. Sanitize
  // every accepted value per the field's declared type so a richtext seed
  // can't smuggle <script> through to the browser via innerHTML.
  const toSeed: { id: number; label: string; sanitized: string }[] = [];
  for (const f of fields) {
    if (f.value != null && f.value !== "") continue;
    const supplied = rawSeed[f.label];
    if (typeof supplied !== "string" || supplied.trim() === "") continue;
    const sanitized = sanitizeForType(supplied, f.type);
    if (sanitized === "") continue;
    toSeed.push({ id: f.id, label: f.label, sanitized });
  }

  if (toSeed.length > 0) {
    await Promise.all(
      toSeed.map((s) =>
        db
          .update(contentFieldsTable)
          .set({ value: s.sanitized })
          .where(eq(contentFieldsTable.id, s.id)),
      ),
    );
    const byId = new Map(toSeed.map((s) => [s.id, s.sanitized]));
    for (const f of fields) {
      const v = byId.get(f.id);
      if (v !== undefined) (f as { value: string | null }).value = v;
    }
  }

  recordPing(projectId, req);
  return res.json({ projectId: String(projectId), content: buildContentMap(fields) });
});

// ── Scanner ───────────────────────────────────────────────────────────────────

/**
 * POST /api/public/content/snapshot
 * Called by the browser scanner script embedded in the developer's app.
 * Saves the DOM scan result so the dashboard "Scan" button can read it.
 * Authenticated by a project key. One snapshot per project — overwrites on repeat.
 */
router.post("/content/snapshot", requireProjectKey, async (req: ProjectKeyRequest, res) => {
  const projectId = req.projectId!;

  const parsed = SnapshotBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid snapshot payload" });
  }

  // Sanitize every label / value the scanner reports so a hostile site
  // hosting our scanner tag can't poison the dashboard preview with stored
  // XSS. We also strip the pageUrl down to origin+path so query-string PII
  // (session ids, tokens, filter params) never enters the snapshot row.
  const cleanSections = parsed.data.sections.map((s) => ({
    ...s,
    title: s.title ? sanitizeContent(s.title) : s.title,
    fields: s.fields.map((f) => ({
      ...f,
      label: sanitizeContent(f.label),
      type: sanitizeContent(f.type),
      value: f.value == null ? f.value : sanitizeForType(f.value, f.type),
      selector: f.selector ? sanitizeContent(f.selector) : f.selector,
    })),
  }));
  const cleanPageUrl = safePageUrl(parsed.data.pageUrl);

  await db
    .insert(contentSnapshotsTable)
    .values({
      projectId,
      sections: cleanSections as unknown as object,
      pageUrl: cleanPageUrl,
      capturedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: contentSnapshotsTable.projectId,
      set: {
        sections: sql`excluded.sections`,
        pageUrl: sql`excluded.page_url`,
        capturedAt: sql`excluded.captured_at`,
      },
    });

  recordPing(projectId, req);
  return res.json({ ok: true });
});

/**
 * GET /api/public/scanner.js
 * Serves the browser-side scanner script. Drop a <script> tag pointing here
 * into any page — the script reads the DOM and sends a content snapshot to
 * POST /api/public/content/snapshot using the project key in `data-key`.
 *
 * Usage:
 *   <script src="https://get-builder.replit.app/api/public/scanner.js"
 *           data-key="pk_live_xxx"></script>
 *
 * Place just before </body> for best results.
 */
router.get("/scanner.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(buildScannerScript());
});

/**
 * GET /api/public/scanner-download?key=pk_xxx
 *
 * Self-hosted variant. Returns the same scanner with the project key + API
 * origin baked in as constants, served as a downloadable attachment so the
 * user can drop it straight into their repo (e.g. public/get-scanner.js) and
 * load it with a single relative <script src="/get-scanner.js"></script> tag.
 *
 * Why this exists: agent-based builders (Replit Agent etc.) refuse to add
 * <script src="https://..."> tags to unverified third-party services. A
 * locally-committed file is just a file the human chose to add — no agent
 * objection, no external dependency at install time.
 */
router.get("/scanner-download", (req, res) => {
  const key = String(req.query.key ?? "");
  if (!key.startsWith("pk_") || key.length < 12 || key.length > 200) {
    res.status(400).type("text/plain").send(
      "Missing or invalid 'key' query param. Expected a project key starting with pk_.",
    );
    return;
  }
  const proto = (req.headers["x-forwarded-proto"] as string)?.split(",")[0] || req.protocol;
  const host = req.headers["x-forwarded-host"] as string || req.headers.host || "";
  const apiOrigin = `${proto}://${host}`;
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="get-scanner.js"');
  res.setHeader("Cache-Control", "no-store");
  res.send(buildScannerScript({ key, apiOrigin }));
});

// ── Scanner script (vanilla JS, no deps) ─────────────────────────────────────

/**
 * Builds the scanner JS. When opts is omitted, the scanner reads its key from
 * its own <script data-key="..."> tag and derives the API origin from its
 * src URL — the classic hosted install. When opts is provided, both values
 * are baked in as constants so the file can be served from the user's own
 * domain (self-hosted install).
 */
function buildScannerScript(opts?: { key: string; apiOrigin: string }): string {
  const bootstrap = opts
    ? `var key = ${JSON.stringify(opts.key)};\n  var origin = ${JSON.stringify(opts.apiOrigin)};`
    : `var scriptEl = document.querySelector('script[src*="scanner.js"][data-key]');
  if (!scriptEl) { console.warn('[get] Scanner: missing script tag or data-key.'); return; }
  var key = scriptEl.getAttribute('data-key');
  if (!key || !key.startsWith('pk_')) { console.warn('[get] Scanner: invalid data-key.'); return; }
  var origin = new URL(scriptEl.src).origin;`;
  return SCANNER_SCRIPT.replace("/*__BOOTSTRAP__*/", bootstrap);
}

const SCANNER_SCRIPT = /* javascript */ `
(function () {
  /*__BOOTSTRAP__*/
  var SNAPSHOT_URL = origin + '/api/public/content/snapshot';
  var CONTENT_URL  = origin + '/api/public/content';

  // ── Editor bridge state (audit High #3) ────────────────────────────────
  // When framed by the get editor, the parent posts us a one-shot
  // get:bridge-init handshake containing a per-mount nonce. We capture the
  // parent's real origin (evt.origin) AND the nonce, then use BOTH to
  // authenticate every subsequent message we send up. If we never receive
  // a bridge-init (e.g. the page is being viewed directly, or some random
  // other page is iframing it) all our outbound messages are no-ops, which
  // means inline-editing simply won't bridge back to anywhere.
  var parentOrigin = null;
  var bridgeNonce = null;
  function postToParent(msg) {
    if (!parentOrigin || !bridgeNonce) return;
    try {
      var payload = {};
      for (var k in msg) if (Object.prototype.hasOwnProperty.call(msg, k)) payload[k] = msg[k];
      payload.nonce = bridgeNonce;
      window.parent.postMessage(payload, parentOrigin);
    } catch (e) {}
  }

  // ── Content injection ─────────────────────────────────────────────────────
  // Fetches the project's published field values and writes them into any
  // element that carries a [data-get-key="Field Label"] attribute.
  //
  // Type rules:
  //   image   → img.src; background-image on non-img elements
  //   url     → element.href (works on <a>)
  //   richtext → element.innerHTML (value is server-sanitised HTML)
  //   text / number / anything else → element.textContent
  //
  // Fire-and-update: we never block the initial render. Default content in the
  // HTML shows first, then swaps as soon as the fetch resolves (typically one
  // network round-trip on the same origin).

  // ── Content-type map ─────────────────────────────────────────────────────
  // Populated by applyContent so the inline-editor can gate by field type
  // (image / url / boolean → redirect to field panel, not contenteditable).
  var contentTypeMap = {};
  // Cached latest content payload — kept around so the Smart Watcher
  // (MutationObserver below) can re-apply values to elements that show
  // up *after* the initial fetch (React/Vue/Svelte hydration, route
  // changes, lazy components). Without this cache the observer would
  // have nothing to apply.
  var latestContent = null;
  // Map from field label → the DOM element pinned during the heuristic scan.
  // Allows applyContent() to update elements on untagged pages (no data-get-key
  // attributes) by falling back to the element reference captured at scan time.
  // Reset at the start of each heuristic scan so stale references never persist.
  var labelToElement = {};

  // Apply a single content value to a DOM element, type-aware.
  // Shared by the tagged-element path and the heuristic-fallback path so both
  // use identical injection logic.
  function applyToEl(el, type, value) {
    if (type === 'image') {
      if (el.tagName === 'IMG') {
        el.src = value;
      } else {
        el.style.backgroundImage = 'url("' + value.replace(/"/g, '\\"') + '")';
      }
    } else if (type === 'url') {
      if ('href' in el) { el.href = value; } else { el.setAttribute('href', value); }
    } else if (type === 'richtext') {
      // Value is server-sanitised HTML — set as innerHTML so formatting renders.
      // Safety: legacy plain-text values (no HTML tags) use textContent so any
      // stray '<' / '&' characters render literally instead of being parsed.
      if (/<[a-zA-Z!\/]/.test(value)) {
        el.innerHTML = value;
      } else {
        el.textContent = value;
      }
    } else {
      el.textContent = value;
    }
  }

  function applyContent(content) {
    latestContent = content;
    for (var label in content) {
      var field = content[label];
      var value = field.value;
      // Always record the type even if value is empty.
      contentTypeMap[label] = field.type;
      if (value == null || value === '') continue;
      var type = field.type;
      // Escape double-quotes in the label so it's safe inside the CSS attribute
      // selector. All other characters are fine as-is for the labels we produce.
      var sel = '[data-get-key="' + label.replace(/"/g, '\\"') + '"]';
      var els = document.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) {
        applyToEl(els[i], type, value);
      }
      // Fallback: if no [data-get-key] element matched, use the element that the
      // heuristic DOM scan pinned to this label. This makes saved edits appear on
      // sites that don't have data-get-key attributes in their HTML — the common
      // case for a vibe coder who installed the scanner but never touched the HTML.
      if (els.length === 0) {
        var fallbackEl = labelToElement[label];
        // Fuzzy fallback: when the user's field is named "Hero" but the scanner
        // produces qualified labels like "Hero Heading" / "Hero Body" / "Hero CTA"
        // / "Hero Image", pick the heuristic label that best fits the field type.
        // This is the common case for users who renamed fields in the editor or
        // created new fields with short names that don't include the role suffix.
        if (!fallbackEl) {
          var prefix = label + ' ';
          var preferred = type === 'image' ? 'Image'
                        : type === 'url'   ? 'CTA'
                        : type === 'richtext' ? 'Body'
                        : 'Heading'; // text / number / default
          var firstMatch = null;
          for (var k in labelToElement) {
            if (k.indexOf(prefix) !== 0) continue;
            if (!firstMatch) firstMatch = k;
            if (k === prefix + preferred) { fallbackEl = labelToElement[k]; break; }
          }
          if (!fallbackEl && firstMatch) fallbackEl = labelToElement[firstMatch];
        }
        if (fallbackEl) applyToEl(fallbackEl, type, value);
      }
    }
  }

  function injectContent() {
    // Mark the page as loading so vibe coders can style the transition.
    // CSS hook: [data-get-loading] [data-get-key] { opacity: 0; }
    // A 3s safety timer removes the attribute if the fetch stalls, so the
    // page never gets stuck in a permanent loading state.
    var html = document.documentElement;
    html.setAttribute('data-get-loading', '');
    var loadingTimer = setTimeout(function() {
      html.removeAttribute('data-get-loading');
    }, 3000);

    fetch(CONTENT_URL, {
      headers: { 'Authorization': 'Bearer ' + key }
    })
    .then(function(r) {
      if (r.status === 401) {
        console.error('[get] Project key rejected (401). Check that data-key in your script tag is the full key (not a placeholder). Go to your get dashboard → Keys tab to create or copy a key.');
        return null;
      }
      if (r.status === 403) {
        console.error('[get] Origin not allowed (403). Add your site domain in your get dashboard → Domains tab.');
        return null;
      }
      if (!r.ok) {
        console.warn('[get] Content fetch failed (' + r.status + '). Your edits may not appear on this page.');
        return null;
      }
      return r.json();
    })
    .then(function(data) {
      if (data && data.content) applyContent(data.content);
    })
    .catch(function() {})
    .finally(function() {
      clearTimeout(loadingTimer);
      html.removeAttribute('data-get-loading');
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  function clean(s) { return (s || '').replace(/\\s+/g, ' ').trim(); }

  function absUrl(href) {
    if (!href) return null;
    try {
      if (/^https?:\\/\\//.test(href)) return href;
      if (href.startsWith('//')) return 'https:' + href;
      if (href.startsWith('/')) return location.origin + href;
      return new URL(href, location.href).href;
    } catch(e) { return null; }
  }

  // Skip these tags when collecting visible text — they're chrome, not content.
  var SKIP_TAGS = new Set(['SCRIPT','STYLE','NOSCRIPT','HEAD','META','LINK','SVG','PATH',
    'IFRAME','OBJECT','EMBED','INPUT','TEXTAREA','SELECT','OPTION','BUTTON','NAV','HEADER']);

  /**
   * Recursively collect all visible text nodes, skipping chrome elements.
   * Returns an array of clean strings — each non-empty leaf text run.
   */
  function collectText(el, out) {
    if (!el) return;
    var tag = (el.tagName || '').toUpperCase();
    if (SKIP_TAGS.has(tag)) return;
    // Skip hidden elements
    try {
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
    } catch(e) {}
    for (var i = 0; i < el.childNodes.length; i++) {
      var node = el.childNodes[i];
      if (node.nodeType === 3) { // TEXT_NODE
        var t = clean(node.nodeValue);
        if (t.length >= 2) out.push(t);
      } else if (node.nodeType === 1) {
        collectText(node, out);
      }
    }
  }

  /**
   * Given a container element, extract ALL editable-looking content:
   *  - Every heading (h1-h6) as its own text field, in DOM order
   *  - ALL visible body text (p, li, blockquote, figcaption, td, dd, span-like)
   *    joined into one richtext field — deduped against already-seen text
   *  - Every distinct link/button with short text as a CTA
   *  - Every <img> (non-data-uri, non-tiny) as an image field
   */
  function extractSection(el, sectionName) {
    var fields = [];

    // ── Headings — every h1-h6 in DOM order ──────────────────────────────
    var hs = el.querySelectorAll('h1,h2,h3,h4,h5,h6');
    var hIdx = 0;
    for (var i = 0; i < hs.length; i++) {
      var ht = clean(hs[i].textContent);
      if (!ht || ht.length > 300 || seenText.has(ht)) continue;
      seenText.add(ht);
      var hLabel = hIdx === 0 ? sectionName + ' Heading'
                  : hIdx === 1 ? sectionName + ' Sub-heading'
                  : sectionName + ' Heading ' + (hIdx + 1);
      fields.push({ label: hLabel, type: 'text', value: ht });
      labelToElement[hLabel] = hs[i];
      hIdx++;
    }

    // ── Body text — every visible paragraph-like element ─────────────────
    // We grab text from p, li, blockquote, figcaption, td, th, dd individually
    // so the order follows the DOM. Each unique run becomes a line.
    var bodyEls = el.querySelectorAll(
      'p, li, blockquote, figcaption, td, th, dd, [class*="desc"], [class*="text"], [class*="copy"], [class*="caption"]'
    );
    var bodyLines = [], firstBodyEl = null;
    for (var bi = 0; bi < bodyEls.length; bi++) {
      // Skip if it contains a heading (the heading already captured above)
      if (bodyEls[bi].querySelector('h1,h2,h3,h4,h5,h6')) continue;
      var bt = clean(bodyEls[bi].textContent);
      if (bt.length < 3 || seenText.has(bt)) continue;
      seenText.add(bt);
      bodyLines.push(bt);
      if (!firstBodyEl) firstBodyEl = bodyEls[bi];
    }
    if (bodyLines.length) {
      fields.push({ label: sectionName + ' Body', type: 'richtext', value: bodyLines.join('\\n') });
      if (firstBodyEl) labelToElement[sectionName + ' Body'] = firstBodyEl;
    }

    // ── CTAs — every distinct button / link with human-readable text ──────
    var ctaEls = el.querySelectorAll('a[href], button[type="button"], button[type="submit"], button:not([type])');
    var ctaIdx = 0;
    for (var ci = 0; ci < ctaEls.length; ci++) {
      var ct = clean(ctaEls[ci].textContent);
      if (ct.length < 2 || ct.length > 80) continue;
      var href = ctaEls[ci].getAttribute('href');
      var abs = href ? absUrl(href) : null;
      // For buttons without href, record the label text as the value
      var val = abs || ct;
      if (seenCtaText.has(ct)) continue;
      seenCtaText.add(ct);
      var ctaLabel = ctaIdx === 0 ? sectionName + ' CTA'
                    : sectionName + ' CTA ' + (ctaIdx + 1);
      var ctaType = abs ? 'url' : 'text';
      fields.push({ label: ctaLabel, type: ctaType, value: val });
      labelToElement[ctaLabel] = ctaEls[ci];
      ctaIdx++;
      if (ctaIdx >= 5) break; // at most 5 CTAs per section
    }

    // ── Images — every visible <img> (skip icons / tiny / data-uris) ──────
    var imgs = el.querySelectorAll('img[src]');
    var imgIdx = 0;
    for (var ii = 0; ii < imgs.length; ii++) {
      var src = imgs[ii].getAttribute('src');
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;
      // Skip tiny icons: naturalWidth/naturalHeight available after load
      var nw = imgs[ii].naturalWidth, nh = imgs[ii].naturalHeight;
      if (nw > 0 && nw < 40 && nh < 40) continue;
      var absSrc = absUrl(src);
      if (!absSrc || seenImages.has(absSrc)) continue;
      seenImages.add(absSrc);
      var imgLabel = imgIdx === 0 ? sectionName + ' Image'
                    : sectionName + ' Image ' + (imgIdx + 1);
      var altText = imgs[ii].getAttribute('alt') || '';
      var imgField = { label: imgLabel, type: 'image', value: absSrc };
      if (altText) imgField.alt = altText;
      fields.push(imgField);
      labelToElement[imgLabel] = imgs[ii];
      imgIdx++;
      if (imgIdx >= 6) break; // at most 6 images per section
    }

    return fields;
  }

  // ── Section naming ────────────────────────────────────────────────────────

  var KEYWORDS = {
    hero: 'Hero', banner: 'Hero', jumbotron: 'Hero', splash: 'Hero',
    about: 'About', story: 'About', mission: 'About', 'who-we': 'About',
    service: 'Services', offering: 'Services', solution: 'Services',
    feature: 'Features', benefit: 'Features', highlight: 'Features',
    how: 'How It Works', process: 'How It Works', step: 'How It Works', workflow: 'How It Works',
    team: 'Team', staff: 'Team', people: 'Team', founder: 'Team',
    testimonial: 'Testimonials', review: 'Testimonials', client: 'Testimonials', quote: 'Testimonials',
    pricing: 'Pricing', plan: 'Pricing', tier: 'Pricing',
    faq: 'FAQ', question: 'FAQ', accordion: 'FAQ',
    contact: 'Contact', 'get-in': 'Contact', reach: 'Contact',
    footer: 'Footer',
    nav: 'Navigation', menu: 'Navigation', header: 'Header',
    cta: 'Call to Action', 'call-to': 'Call to Action',
    gallery: 'Gallery', portfolio: 'Portfolio', work: 'Portfolio',
    blog: 'Blog', post: 'Blog', article: 'Blog',
    partner: 'Partners', logo: 'Partners', sponsor: 'Partners',
    stat: 'Stats', number: 'Stats', metric: 'Stats',
    award: 'Awards', trust: 'Trust'
  };

  function inferName(el) {
    var aria = el.getAttribute('aria-label');
    if (aria && aria.length <= 60) return aria;
    var id = (el.id || '').toLowerCase();
    var cls = (el.className && typeof el.className === 'string') ? el.className.toLowerCase() : '';
    var combined = id + ' ' + cls;
    for (var kw in KEYWORDS) {
      if (combined.indexOf(kw) >= 0) return KEYWORDS[kw];
    }
    return null;
  }

  // ── Tagged-element scan (preferred path) ─────────────────────────────────
  //
  // If the developer has already placed [data-get-key] attributes on their
  // page, those are the canonical list of editable fields. We report them
  // directly instead of running the heuristic DOM scan, giving a precise,
  // zero-false-positive result.
  //
  // Section grouping: we use the first word(s) of the label up to the last
  // space as the section name (e.g. "Hero Heading" → "Hero",
  // "CTA Link" → "CTA", "FAQ Question 1" → "FAQ"). Single-word labels get
  // grouped under "Content".
  //
  // Type inference:
  //   <img>           → image  (value = src)
  //   <a>             → url    (value = href)
  //   long text (>80) → richtext
  //   everything else → text

  function scanTagged() {
    var tagged = document.querySelectorAll('[data-get-key]');
    if (!tagged.length) return null; // no tagged elements → use heuristic scan

    var sectionMap = {};
    var sectionOrder = [];

    for (var i = 0; i < tagged.length; i++) {
      var el = tagged[i];
      var label = (el.getAttribute('data-get-key') || '').trim();
      if (!label) continue;

      // Infer type from element tag
      var tag = (el.tagName || '').toUpperCase();
      var ftype;
      if (tag === 'IMG') {
        ftype = 'image';
      } else if (tag === 'A') {
        ftype = 'url';
      } else {
        var txt = clean(el.textContent);
        ftype = txt.length > 80 ? 'richtext' : 'text';
      }

      // Extract current DOM value
      var fvalue;
      if (ftype === 'image') {
        fvalue = absUrl(el.getAttribute('src') || el.getAttribute('data-src') || '') || '';
      } else if (ftype === 'url') {
        fvalue = absUrl(el.getAttribute('href') || '') || '';
      } else {
        fvalue = clean(el.textContent) || '';
      }

      // Section name = everything except the last word of the label.
      // "Hero Heading" → "Hero", "CTA Link" → "CTA", "FAQ" → "Content".
      var words = label.split(/\s+/);
      var sectionName = words.length > 1 ? words.slice(0, -1).join(' ') : 'Content';

      if (!sectionMap[sectionName]) {
        sectionMap[sectionName] = [];
        sectionOrder.push(sectionName);
      }
      sectionMap[sectionName].push({ label: label, type: ftype, value: fvalue });
    }

    var sections = [];
    for (var j = 0; j < sectionOrder.length; j++) {
      var sname = sectionOrder[j];
      sections.push({ name: sname, fields: sectionMap[sname] });
    }
    return sections.length ? sections : null;
  }

  // ── Main scan ─────────────────────────────────────────────────────────────

  var seenText, seenImages, seenCtaText;

  function scan() {
    // Prefer explicit data-get-key elements when the developer has tagged them.
    var tagged = scanTagged();
    if (tagged) return tagged;

    // Fallback: heuristic DOM scan for untagged pages.
    seenText = new Set();
    seenImages = new Set();
    seenCtaText = new Set();
    labelToElement = {};
    var sections = [];
    var usedNames = {};

    function addSection(name, el) {
      var count = usedNames[name] || 0;
      usedNames[name] = count + 1;
      var displayName = count === 0 ? name : name + ' ' + (count + 1);
      var fields = extractSection(el, displayName);
      if (fields.length > 0) sections.push({ name: displayName, fields: fields });
    }

    // ── Pass 1: semantic containers (section, article, main > direct children)
    var semantics = Array.prototype.slice.call(
      document.querySelectorAll('main > section, main > article, body > section, body > article')
    );
    // Also collect top-level divs in main that look like sections
    var mainEl = document.querySelector('main') || document.body;
    var directChildren = Array.prototype.slice.call(mainEl.children);
    for (var di = 0; di < directChildren.length; di++) {
      var dc = directChildren[di];
      var dTag = (dc.tagName || '').toUpperCase();
      if (dTag === 'SECTION' || dTag === 'ARTICLE') continue; // already in semantics
      if (dTag === 'DIV' || dTag === 'ASIDE') {
        var hasHeading = dc.querySelector('h1,h2,h3,h4');
        if (hasHeading) semantics.push(dc);
      }
    }

    // ── Pass 2: named containers anywhere in the page (id/class based)
    var named = Array.prototype.slice.call(
      document.querySelectorAll('[id], [class]')
    ).filter(function(el) {
      // Only keep elements that have a meaningful name AND contain a heading
      var name = inferName(el);
      if (!name) return false;
      // Skip if it's nested inside a semantic element we already have
      var par = el.parentElement;
      while (par) {
        var pt = (par.tagName || '').toUpperCase();
        if (pt === 'SECTION' || pt === 'ARTICLE') return false;
        par = par.parentElement;
      }
      return el.querySelector('h1,h2,h3,h4,h5,h6') != null;
    });

    // Merge: semantics first (in DOM order), then named ones not already covered
    var covered = new Set();
    var allCandidates = semantics.concat(named);

    // Sort by DOM order
    allCandidates.sort(function(a, b) {
      var pos = a.compareDocumentPosition(b);
      return pos & 4 ? -1 : pos & 2 ? 1 : 0;
    });

    // Deduplicate: skip if ancestor already in covered
    for (var i = 0; i < allCandidates.length && sections.length < 25; i++) {
      var el = allCandidates[i];
      // Skip if it's a descendant of an element we already captured
      var skip = false;
      covered.forEach(function(anc) {
        if (!skip && anc !== el && anc.contains(el)) skip = true;
      });
      if (skip) continue;

      var name = inferName(el);
      if (!name) {
        var fh = el.querySelector('h1,h2,h3');
        if (fh) {
          var ft = clean(fh.textContent);
          if (ft && ft.length <= 80) name = ft;
        }
      }
      if (!name) continue;

      covered.add(el);
      addSection(name, el);
    }

    // ── Fallback A: heading-based grouping if nothing found ───────────────
    if (sections.length === 0) {
      var hEls = document.querySelectorAll('h1,h2,h3');
      for (var hi = 0; hi < hEls.length && sections.length < 20; hi++) {
        var hText = clean(hEls[hi].textContent);
        if (!hText || hText.length > 200 || seenText.has(hText)) continue;
        seenText.add(hText);
        var sname = hText.length <= 60 ? hText : hText.slice(0, 60) + '\\u2026';
        var sfields = [{ label: sname + ' Heading', type: 'text', value: hText }];
        labelToElement[sname + ' Heading'] = hEls[hi];

        // Collect all text siblings until next heading
        var sib = hEls[hi].nextElementSibling;
        var lim = 20, bodyLines = [], firstBodySib = null;
        while (sib && lim-- > 0) {
          if (/^H[1-6]$/.test(sib.tagName)) break;
          var textNodes = [];
          collectText(sib, textNodes);
          for (var ti = 0; ti < textNodes.length; ti++) {
            var tv = textNodes[ti];
            if (tv.length >= 2 && !seenText.has(tv)) {
              seenText.add(tv);
              bodyLines.push(tv);
              if (!firstBodySib) firstBodySib = sib;
            }
          }
          // Grab images too
          var sibImgs = sib.querySelectorAll('img[src]');
          for (var sii = 0; sii < sibImgs.length; sii++) {
            var ssrc = sibImgs[sii].getAttribute('src');
            if (!ssrc || ssrc.startsWith('data:')) continue;
            var sabsSrc = absUrl(ssrc);
            if (sabsSrc && !seenImages.has(sabsSrc)) {
              seenImages.add(sabsSrc);
              sfields.push({ label: sname + ' Image', type: 'image', value: sabsSrc });
            }
          }
          sib = sib.nextElementSibling;
        }
        if (bodyLines.length) {
          sfields.push({ label: sname + ' Body', type: 'richtext', value: bodyLines.join('\\n') });
          if (firstBodySib) labelToElement[sname + ' Body'] = firstBodySib;
        }
        sections.push({ name: sname, fields: sfields });
      }
    }

    // ── Fallback B: whole-page sweep — pull every unique text run ─────────
    if (sections.length === 0) {
      var allTextNodes = [];
      collectText(document.body, allTextNodes);
      var uniqueLines = [];
      var seenFallback = new Set();
      for (var ai = 0; ai < allTextNodes.length; ai++) {
        var atv = allTextNodes[ai];
        if (atv.length >= 2 && !seenFallback.has(atv)) {
          seenFallback.add(atv);
          uniqueLines.push(atv);
        }
      }
      var title = clean(document.title);
      var metaEl = document.querySelector('meta[name="description"]');
      var desc = metaEl ? clean(metaEl.getAttribute('content') || '') : '';
      var pgFields = [];
      if (title) pgFields.push({ label: 'Page Title', type: 'text', value: title });
      if (desc) pgFields.push({ label: 'Page Description', type: 'richtext', value: desc });
      if (uniqueLines.length) pgFields.push({ label: 'Page Content', type: 'richtext', value: uniqueLines.join('\\n') });
      if (pgFields.length) sections.push({ name: 'Page', fields: pgFields });
    }

    return sections;
  }

  // ── Send ─────────────────────────────────────────────────────────────────
  //
  // Scanning strategy:
  //   1) Initial scan as soon as the DOM is ready. Captures static / SSR'd content.
  //   2) Delayed re-scan ~3s later. Captures content that arrives via async
  //      data-fetch, hydration, or staggered animations on a typical SPA.
  //   3) On SPA navigation (history.pushState / replaceState / popstate) re-scan
  //      again ~1.5s after the URL changes. Captures route-specific content.
  //
  // We compute a content fingerprint (sections.length + total field count +
  // first heading) and only POST when it differs from the last-sent fingerprint.
  // The server stores one row per project (latest wins), so re-posting the same
  // content is harmless but wastes a request — this short-circuit avoids that.

  var lastFingerprint = '';

  function fingerprintOf(sections) {
    var fc = 0;
    var firstHeading = '';
    for (var i = 0; i < sections.length; i++) {
      fc += (sections[i].fields || []).length;
      if (!firstHeading && sections[i].fields && sections[i].fields.length) {
        firstHeading = sections[i].fields[0].value || '';
      }
    }
    return sections.length + ':' + fc + ':' + firstHeading.slice(0, 60);
  }

  function sendSnapshot() {
    try {
      // scan() resets its own dedup sets each call, so a re-scan re-collects
      // any text/images that have appeared since the previous scan.
      var sections = scan();
      if (!sections.length) return;
      var fp = fingerprintOf(sections);
      if (fp === lastFingerprint) return;
      lastFingerprint = fp;
      fetch(SNAPSHOT_URL, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections: sections, pageUrl: location.href })
      }).catch(function () {});
    } catch(e) {
      console.warn('[get] Scanner error:', e);
    }
  }

  // Run content injection + initial scan, then a delayed re-scan to catch
  // async-loaded content. Injection runs first so managed elements update ASAP.
  function runInitialAndDelayed() {
    injectContent();
    sendSnapshot();
    setTimeout(sendSnapshot, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitialAndDelayed);
  } else {
    runInitialAndDelayed();
  }

  // ── SPA navigation handling ──────────────────────────────────────────────
  // Most SPAs use history.pushState / replaceState for client-side routing.
  // We monkey-patch them so we can re-scan ~1.5s after the new route's content
  // has had a chance to render.
  var navTimer = null;
  function scheduleNavScan() {
    if (navTimer) clearTimeout(navTimer);
    navTimer = setTimeout(function () {
      // Re-inject first so any elements that just rendered get their values.
      injectContent();
      // Reset fingerprint on a new URL so we always re-send for new routes.
      lastFingerprint = '';
      sendSnapshot();
    }, 1500);
  }

  try {
    var origPush = history.pushState;
    var origReplace = history.replaceState;
    history.pushState = function () { var r = origPush.apply(this, arguments); scheduleNavScan(); return r; };
    history.replaceState = function () { var r = origReplace.apply(this, arguments); scheduleNavScan(); return r; };
    window.addEventListener('popstate', scheduleNavScan);
    window.addEventListener('hashchange', scheduleNavScan);
  } catch(e) {}

  // ── Highlight overlay (live editor preview) ──────────────────────────────
  // Accepts postMessage({ type: 'get:highlight', label: string | null }) from
  // the get editor when it is showing this page in an iframe side-by-side.
  // Adds/removes the .get-highlight class on the matching [data-get-key]
  // element so clients can instantly see which element they are editing.
  //
  // Fully backward-compatible: pages that never receive a message are
  // unaffected. No errors are thrown on older installs.
  (function () {
    function injectHighlightStyle() {
      if (document.getElementById('get-hl-style')) return;
      var s = document.createElement('style');
      s.id = 'get-hl-style';
      s.textContent =
        '.get-highlight{' +
          'outline:3px solid #facc15;' +
          'outline-offset:2px;' +
          'box-shadow:0 0 0 5px rgba(250,204,21,.25);' +
          'border-radius:2px;' +
          'animation:get-hl-pulse 1.5s ease-in-out infinite alternate;' +
        '}' +
        '@keyframes get-hl-pulse{' +
          'from{box-shadow:0 0 0 3px rgba(250,204,21,.25)}' +
          'to{box-shadow:0 0 0 7px rgba(250,204,21,.45)}' +
        '}';
      (document.head || document.documentElement).appendChild(s);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', injectHighlightStyle);
    } else {
      injectHighlightStyle();
    }

    window.addEventListener('message', function (evt) {
      try {
        var msg = evt.data;
        if (!msg || typeof msg.type !== 'string') return;

        // ── Bridge handshake from the get editor ──────────────────────────
        // The very first thing the editor sends is a get:bridge-init with a
        // per-mount nonce. We trust evt.origin here (it's wherever the
        // parent really is) and store both for later auth — but only when
        // we are actually framed, since stand-alone pages should not
        // accept any "parent" instructions.
        if (msg.type === 'get:bridge-init' && window.self !== window.top) {
          if (typeof msg.nonce === 'string' && msg.nonce.length > 0) {
            parentOrigin = evt.origin;
            bridgeNonce = msg.nonce;
          }
          return;
        }

        // After handshake, every other inbound message must come from the
        // SAME origin we handshook with AND carry the matching nonce. This
        // shuts down message spoofing from any other window/tab that might
        // somehow reach us.
        if (!parentOrigin || evt.origin !== parentOrigin) return;
        if (msg.nonce !== bridgeNonce) return;

        if (msg.type !== 'get:highlight') return;
        // Remove any existing highlights.
        var prev = document.querySelectorAll('.get-highlight');
        for (var i = 0; i < prev.length; i++) prev[i].classList.remove('get-highlight');
        // Apply new highlight if a label was provided.
        // CSS.escape handles any character that would break a selector (brackets,
        // backslashes, colons, etc.). Falls back to a manual quote-escape for
        // browsers without CSS.escape (IE11 and some older WebViews).
        if (msg.label) {
          var label = String(msg.label);
          var escaped = (typeof CSS !== 'undefined' && CSS.escape)
            ? CSS.escape(label)
            : label.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
          var sel = '[data-get-key="' + escaped + '"]';
          var el = document.querySelector(sel);
          if (el) el.classList.add('get-highlight');
        }
      } catch (e2) {}
    });

    // ── Click-to-edit (active only when embedded as editor preview) ──────
    // Hovering a [data-get-key] element shows a blue ring + tooltip.
    // Clicking posts { type: 'get:field-click', label } to the parent editor
    // frame, which scrolls and focuses the matching field panel entry.
    // Completely inert when the page is viewed stand-alone (not in an iframe).
    if (window.self !== window.top) {
      function setupClickToEdit() {
        if (document.getElementById('get-click-style')) return; // already wired

        // Hover ring — skip elements that already have the yellow active highlight
        var cs = document.createElement('style');
        cs.id = 'get-click-style';
        cs.textContent =
          '[data-get-key]{cursor:pointer!important;}' +
          '[data-get-key]:not(.get-highlight):hover{' +
            'outline:2px solid rgba(59,130,246,0.50)!important;' +
            'outline-offset:2px;' +
            'border-radius:2px;' +
          '}';
        (document.head || document.documentElement).appendChild(cs);

        // Single shared tooltip — absolutely positioned, never in the flow
        var tip = document.createElement('div');
        tip.id = 'get-edit-tip';
        tip.setAttribute('style',
          'position:fixed;z-index:2147483647;pointer-events:none;' +
          'background:rgba(26,26,46,0.90);color:#fff;' +
          'font-size:12px;font-family:system-ui,-apple-system,sans-serif;' +
          'padding:5px 10px;border-radius:7px;white-space:nowrap;display:none;' +
          'box-shadow:0 2px 10px rgba(0,0,0,0.28);letter-spacing:0.01em;');
        (document.body || document.documentElement).appendChild(tip);

        // Walk up from the event target to the nearest [data-get-key] ancestor.
        // Cap at 40 levels — React / framework component trees can be deeply
        // nested and 10 was too conservative for real-world pages.
        function nearestKey(target) {
          var el = target;
          for (var lim = 0; el && el !== document.body && lim < 40; lim++, el = el.parentElement) {
            if (el.hasAttribute && el.hasAttribute('data-get-key')) return el;
          }
          return null;
        }

        // Show tooltip near the cursor on mouseover; update position as the
        // cursor moves within the same tagged element via mousemove.
        function showTip(e) {
          var el = nearestKey(e.target);
          if (!el) { tip.style.display = 'none'; return; }
          var lbl = el.getAttribute('data-get-key') || '';
          tip.textContent = 'Click to edit: ' + lbl;
          // Position 16px below+right of cursor; clamp to stay within viewport.
          var x = e.clientX + 14;
          var y = e.clientY + 18;
          if (x + 220 > window.innerWidth) x = e.clientX - 14 - 220;
          if (y + 32 > window.innerHeight) y = e.clientY - 32;
          tip.style.display = 'block';
          tip.style.left = Math.max(4, x) + 'px';
          tip.style.top = Math.max(4, y) + 'px';
        }
        // Wrap in an arrow function so variable resolution happens at call time,
        // not at bind time — this ensures the inline-edit showTip override
        // (installed later in setupClickToEdit) applies to this listener too.
        document.addEventListener('mouseover', function(e) { showTip(e); });
        document.addEventListener('mousemove', function(e) {
          if (tip.style.display === 'none') return;
          showTip(e);
        });

        // Hide tooltip on mouseout — only when the mouse actually leaves the
        // tagged element, not when it moves to a child node of the same element.
        document.addEventListener('mouseout', function(e) {
          var el = nearestKey(e.target);
          if (!el) return;
          // relatedTarget is where the mouse is going. If it's still inside
          // the same tagged ancestor we do nothing (avoids flicker on children).
          if (el.contains(e.relatedTarget)) return;
          tip.style.display = 'none';
        });

        // ── Inline editing state ───────────────────────────────────────────
        // Tracks the currently-active contenteditable field, if any.
        var activeEdit = null;

        // Returns true when a [data-get-key] element should open inline editing.
        // Excluded by DOM tag: IMG, A, form controls (they use get:field-click).
        // Excluded by server type: image / url / boolean (even on non-native tags).
        function isEditableTextField(el, lbl) {
          var tag = (el.tagName || '').toUpperCase();
          if (tag === 'IMG' || tag === 'A' || tag === 'INPUT' ||
              tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') {
            return false;
          }
          var serverType = contentTypeMap[lbl];
          if (serverType === 'image' || serverType === 'url' || serverType === 'boolean') {
            return false;
          }
          return true;
        }

        // Position the mini-toolbar above (or below) its target element.
        // tbwHint: estimated toolbar width in px (used for edge clamping before layout).
        function positionToolbar(toolbar, el, tbwHint) {
          var rect = el.getBoundingClientRect();
          var tbw = tbwHint || 168;
          var top = rect.top - 44;
          if (top < 8) top = rect.bottom + 8;
          var left = rect.left;
          if (left + tbw > window.innerWidth - 8) left = window.innerWidth - tbw - 8;
          toolbar.style.top = Math.max(4, top) + 'px';
          toolbar.style.left = Math.max(4, left) + 'px';
        }

        function makeBtn(text, bg, color) {
          var b = document.createElement('button');
          b.textContent = text;
          b.setAttribute('style',
            'background:' + bg + ';color:' + color + ';border:none;cursor:pointer;' +
            'padding:5px 11px;border-radius:6px;font-size:12px;font-weight:600;' +
            'font-family:system-ui,-apple-system,sans-serif;line-height:1;' +
            'flex-shrink:0;');
          return b;
        }

        // Compact format button for the rich-text toolbar (Bold, Italic, etc.)
        function makeFormatBtn(label) {
          var b = document.createElement('button');
          b.textContent = label;
          b.setAttribute('style',
            'background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.20);' +
            'cursor:pointer;padding:3px 8px;border-radius:5px;font-size:12px;font-weight:700;' +
            'font-family:system-ui,-apple-system,sans-serif;line-height:1.4;flex-shrink:0;' +
            'min-width:26px;text-align:center;');
          return b;
        }

        // ── Rich-text HTML sanitiser ──────────────────────────────────────
        // Strips everything except a safe allowlist before sending via postMessage.
        // Allowed: b, strong, i, em, ul, ol, li, a[href], br, p
        function sanitizeRich(html) {
          if (!html) return '';
          var ALLOWED = { B:1, STRONG:1, I:1, EM:1, UL:1, OL:1, LI:1, A:1, BR:1, P:1 };
          function processChildren(parent) {
            var i = 0;
            while (i < parent.childNodes.length) {
              var node = parent.childNodes[i];
              if (node.nodeType === 1) {
                var tag = node.tagName.toUpperCase();
                if (ALLOWED[tag]) {
                  // Remove all attributes except href on <a>; block dangerous protocols
                  var attrs = Array.prototype.slice.call(node.attributes);
                  for (var ai = 0; ai < attrs.length; ai++) {
                    if (tag === 'A' && attrs[ai].name === 'href') continue;
                    node.removeAttribute(attrs[ai].name);
                  }
                  if (tag === 'A') {
                    var h = (node.getAttribute('href') || '').trim();
                    if (/^(javascript|data|vbscript):/i.test(h)) node.removeAttribute('href');
                  }
                  processChildren(node);
                  i++;
                } else {
                  // Unwrap: hoist children before this node, then delete it.
                  // Do NOT increment — newly-hoisted children sit at index i.
                  while (node.firstChild) parent.insertBefore(node.firstChild, node);
                  parent.removeChild(node);
                }
              } else {
                i++;
              }
            }
          }
          try {
            var doc = (new DOMParser()).parseFromString(html, 'text/html');
            processChildren(doc.body);
            return doc.body.innerHTML;
          } catch(e) { return ''; }
        }

        // Deactivate the active inline edit.
        // revert=true  → restore original content and flush get:field-input with it.
        // revert=false → flush current content before tearing down, so
        //                Escape / click-outside never silently drop the last
        //                keystrokes that the debounce timer hadn't sent yet.
        function deactivate(revert) {
          if (!activeEdit) return;
          var ae = activeEdit;
          activeEdit = null;
          // Cancel any pending debounce — we are about to flush synchronously.
          if (ae.inputTimer) { clearTimeout(ae.inputTimer); ae.inputTimer = null; }
          // Capture current content BEFORE removing contenteditable.
          // For richtext we use sanitized innerHTML; for plain text we use textContent.
          var finalText = ae.isRich ? sanitizeRich(ae.el.innerHTML || '') : ae.el.textContent || '';
          ae.el.removeAttribute('contenteditable');
          ae.el.style.outline = ae.originalOutline;
          ae.el.style.outlineOffset = ae.originalOutlineOffset;
          ae.el.removeEventListener('input', ae.onInput);
          ae.el.removeEventListener('keydown', ae.onKeydown);
          ae.el.removeEventListener('paste', ae.onPaste);
          if (ae.onUnlinkVisibilityChange) {
            document.removeEventListener('selectionchange', ae.onUnlinkVisibilityChange);
            ae.el.removeEventListener('keyup', ae.onUnlinkVisibilityChange);
            ae.el.removeEventListener('mouseup', ae.onUnlinkVisibilityChange);
          }
          if (ae.onScrollResize) {
            window.removeEventListener('scroll', ae.onScrollResize, true);
            window.removeEventListener('resize', ae.onScrollResize);
          }
          if (ae.toolbar && ae.toolbar.parentNode) {
            ae.toolbar.parentNode.removeChild(ae.toolbar);
          }
          if (revert) {
            if (ae.isRich) { ae.el.innerHTML = ae.originalText; }
            else { ae.el.textContent = ae.originalText; }
            postToParent({ type: 'get:field-input', label: ae.label, value: ae.originalText });
          } else {
            // Always flush the final value so the editor panel stays in sync
            // even when the debounce hadn't fired before Escape / click-outside.
            postToParent({ type: 'get:field-input', label: ae.label, value: finalText });
          }
          // Blur so the element loses focus visually after deactivation.
          try { ae.el.blur(); } catch(e) {}
        }

        // Activate inline editing on a [data-get-key] text element.
        // For 'richtext' fields the toolbar gains formatting buttons (Bold, Italic,
        // Bullet list, Link) and the element is edited as HTML instead of plaintext.
        function activate(el, lbl) {
          if (activeEdit) deactivate(false);

          // Detect field type from the server-populated map.
          var isRich = contentTypeMap[lbl] === 'richtext';

          // Normalize richtext HTML *before* contentEditable activates so the
          // user starts editing the same allowlist-clean DOM that will be saved.
          // Without this, deeply-nested existing HTML (e.g. <span><font><b>…)
          // produces unpredictable behaviour while typing — the cursor jumps,
          // toggling Bold deletes wrappers, etc. Sanitizing up-front collapses
          // all of that to the safe tag set, making the round-trip predictable.
          if (isRich) {
            try {
              var normalised = sanitizeRich(el.innerHTML || '');
              if (normalised !== el.innerHTML) el.innerHTML = normalised;
            } catch (e) {}
          }

          // Capture original content — innerHTML for richtext, textContent for plain.
          var originalText = isRich ? (el.innerHTML || '') : (el.textContent || '');
          var originalOutline = el.style.outline || '';
          var originalOutlineOffset = el.style.outlineOffset || '';

          // Make editable — richtext uses HTML mode; plain text prefers plaintext-only.
          if (isRich) {
            el.contentEditable = 'true';
          } else {
            try { el.contentEditable = 'plaintext-only'; } catch(ex) {}
            if (el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
          }

          el.style.outline = '2px solid rgba(59,130,246,0.70)';
          el.style.outlineOffset = '3px';

          // ── Floating mini-toolbar ──────────────────────────────────────
          var toolbar = document.createElement('div');
          toolbar.setAttribute('style',
            'position:fixed;z-index:2147483647;display:flex;align-items:center;gap:5px;' +
            'background:rgba(26,26,46,0.95);border-radius:8px;padding:5px 8px;' +
            'box-shadow:0 4px 20px rgba(0,0,0,0.38);pointer-events:auto;' +
            'font-family:system-ui,-apple-system,sans-serif;flex-wrap:nowrap;');

          // ── Rich-text format buttons (richtext fields only) ────────────
          if (isRich) {
            var boldBtn   = makeFormatBtn('B');
            var italicBtn = makeFormatBtn('I');
            var listBtn   = makeFormatBtn('\\u2022');
            var linkBtn   = makeFormatBtn('\\uD83D\\uDD17');
            var unlinkBtn = makeFormatBtn('\\uD83D\\uDD17\\u00D7');
            boldBtn.title   = 'Bold';
            italicBtn.title = 'Italic';
            listBtn.title   = 'Bullet list';
            linkBtn.title   = 'Insert link';
            unlinkBtn.title = 'Remove link';
            // Style the Bold and Italic labels for visual clarity
            boldBtn.style.fontStyle   = 'normal';
            italicBtn.style.fontStyle = 'italic';
            // Unlink button is only shown when caret is inside an <a>
            unlinkBtn.style.display = 'none';
            toolbar.appendChild(boldBtn);
            toolbar.appendChild(italicBtn);
            toolbar.appendChild(listBtn);
            toolbar.appendChild(linkBtn);
            toolbar.appendChild(unlinkBtn);
            // Separator between format buttons and Save/Cancel
            var sep = document.createElement('div');
            sep.setAttribute('style',
              'width:1px;background:rgba(255,255,255,0.22);align-self:stretch;' +
              'margin:0 2px;flex-shrink:0;');
            toolbar.appendChild(sep);
          }

          var saveBtn   = makeBtn('\\u2713 Save',   '#facc15', '#1a1a2e');
          var cancelBtn = makeBtn('\\u2715 Cancel', 'rgba(255,255,255,0.13)', '#fff');
          toolbar.appendChild(saveBtn);
          toolbar.appendChild(cancelBtn);
          (document.body || document.documentElement).appendChild(toolbar);
          var tbwHint = isRich ? 310 : 168;
          positionToolbar(toolbar, el, tbwHint);
          function onScrollResize() { positionToolbar(toolbar, el, tbwHint); }
          window.addEventListener('scroll', onScrollResize, true);
          window.addEventListener('resize', onScrollResize);

          // ── Helper: get the current edited value ───────────────────────
          function getValue() {
            return isRich ? sanitizeRich(el.innerHTML || '') : el.textContent || '';
          }

          // ── Input → debounced postMessage ──────────────────────────────
          var inputTimer = null;
          function onInput() {
            var val = getValue();
            if (inputTimer) clearTimeout(inputTimer);
            inputTimer = setTimeout(function() {
              inputTimer = null;
              if (activeEdit) activeEdit.inputTimer = null;
              postToParent({ type: 'get:field-input', label: lbl, value: val });
            }, 200);
            if (activeEdit) activeEdit.inputTimer = inputTimer;
          }

          // ── Paste handler ──────────────────────────────────────────────
          // Rich fields: allow HTML paste but sanitize it.
          // Plain fields: strip to plain text only.
          function onPaste(e) {
            e.preventDefault();
            if (isRich) {
              var html = '';
              try { html = (e.clipboardData || window.clipboardData).getData('text/html'); } catch(ex) {}
              if (html) {
                html = sanitizeRich(html);
                try { document.execCommand('insertHTML', false, html); } catch(ex) {
                  var pt = '';
                  try { pt = (e.clipboardData || window.clipboardData).getData('text/plain'); } catch(ex2) {}
                  try { document.execCommand('insertText', false, pt); } catch(ex3) { el.innerHTML += pt; }
                }
              } else {
                var plainText = '';
                try { plainText = (e.clipboardData || window.clipboardData).getData('text/plain'); } catch(ex) {}
                try { document.execCommand('insertText', false, plainText); } catch(ex) { el.innerHTML += plainText; }
              }
            } else {
              var text = '';
              try { text = (e.clipboardData || window.clipboardData).getData('text/plain'); } catch(ex) {}
              try { document.execCommand('insertText', false, text); } catch(ex) {
                el.textContent = (el.textContent || '') + text;
              }
            }
          }

          // ── Keyboard: Escape = commit (keep value) ─────────────────────
          function onKeydown(e) {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              deactivate(false);
            }
          }

          el.addEventListener('input', onInput);
          el.addEventListener('keydown', onKeydown);
          el.addEventListener('paste', onPaste);

          // ── Format button handlers (richtext only) ─────────────────────
          // mousedown with preventDefault keeps focus on the contenteditable el.
          var onUnlinkVisibilityChange = null;
          if (isRich) {
            function attachFormat(btn, cmd, promptUrl) {
              btn.addEventListener('mousedown', function(e) { e.preventDefault(); });
              btn.addEventListener('click', function(e) {
                e.stopPropagation();
                el.focus();
                if (promptUrl) {
                  var url = prompt('Enter URL (e.g. https://example.com):', 'https://');
                  if (url) {
                    // Strip dangerous protocols before inserting
                    if (!/^(javascript|data|vbscript):/i.test(url.trim())) {
                      try { document.execCommand('createLink', false, url); } catch(ex) {}
                    }
                  }
                } else {
                  try { document.execCommand(cmd, false, null); } catch(ex) {}
                }
                // execCommand fires 'input' automatically in most browsers;
                // fall back to a manual flush for browsers that don't.
                setTimeout(function() {
                  postToParent({ type: 'get:field-input', label: lbl, value: getValue() });
                }, 0);
              });
            }
            attachFormat(boldBtn,   'bold',                   false);
            attachFormat(italicBtn, 'italic',                 false);
            attachFormat(listBtn,   'insertUnorderedList',    false);
            attachFormat(linkBtn,   null,                     true);
            attachFormat(unlinkBtn, 'unlink',                 false);

            // Show / hide the Unlink button based on whether the caret
            // is currently inside an <a> within this editable element.
            function updateUnlinkVisibility() {
              var sel = window.getSelection();
              var inLink = false;
              if (sel && sel.rangeCount > 0) {
                var node = sel.anchorNode;
                while (node && node !== el) {
                  if (node.nodeType === 1 && node.tagName === 'A') {
                    inLink = true; break;
                  }
                  node = node.parentNode;
                }
              }
              unlinkBtn.style.display = inLink ? '' : 'none';
              positionToolbar(toolbar, el, tbwHint);
            }
            document.addEventListener('selectionchange', updateUnlinkVisibility);
            el.addEventListener('keyup', updateUnlinkVisibility);
            el.addEventListener('mouseup', updateUnlinkVisibility);
            onUnlinkVisibilityChange = updateUnlinkVisibility;
            // Run once after activation so initial state reflects whether
            // the field happens to start with the caret inside a link.
            setTimeout(updateUnlinkVisibility, 0);
          }

          // ── Toolbar button handlers ────────────────────────────────────
          // mousedown prevents the blur from firing before the click.
          saveBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });
          saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var val = getValue();
            if (activeEdit && activeEdit.inputTimer) {
              clearTimeout(activeEdit.inputTimer);
              activeEdit.inputTimer = null;
            }
            // Sync final value, then ask the editor to save it.
            // We include the value in get:field-save so the editor can pass it
            // directly to the save API without reading from possibly-stale state.
            postToParent({ type: 'get:field-input', label: lbl, value: val });
            postToParent({ type: 'get:field-save',  label: lbl, value: val });
            deactivate(false);
          });

          cancelBtn.addEventListener('mousedown', function(e) { e.preventDefault(); });
          cancelBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deactivate(true); // revert to original
          });

          activeEdit = {
            el: el, label: lbl, isRich: isRich,
            originalText: originalText,
            originalOutline: originalOutline,
            originalOutlineOffset: originalOutlineOffset,
            toolbar: toolbar,
            onInput: onInput, onKeydown: onKeydown, onPaste: onPaste,
            onScrollResize: onScrollResize,
            onUnlinkVisibilityChange: onUnlinkVisibilityChange,
            inputTimer: null,
          };

          // Focus and move caret to end.
          el.focus();
          try {
            var range = document.createRange();
            var sel = window.getSelection();
            range.selectNodeContents(el);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
          } catch(ex) {}
        }

        // ── Click-outside → commit (keep value) ───────────────────────────
        document.addEventListener('mousedown', function(e) {
          if (!activeEdit) return;
          var ae = activeEdit;
          if (ae.toolbar && ae.toolbar.contains(e.target)) return;
          if (ae.el && ae.el.contains(e.target)) return;
          deactivate(false);
        }, true);

        // ── Tooltip: skip the currently-active element ─────────────────────
        // Wrap showTip so it hides itself when we are already inline-editing.
        var origShowTip = showTip;
        showTip = function(e) {
          if (activeEdit && activeEdit.el === nearestKey(e.target)) {
            tip.style.display = 'none';
            return;
          }
          origShowTip(e);
        };

        // Intercept click — use capture phase to run before any site handlers
        // (important for tagged <a> elements that would otherwise navigate)
        document.addEventListener('click', function(e) {
          var el = nearestKey(e.target);
          if (!el) return;

          var lbl = el.getAttribute('data-get-key') || '';

          // If the user is clicking inside the currently-active editable element
          // let the browser handle cursor placement — do not intercept.
          if (activeEdit && activeEdit.el === el) return;

          e.preventDefault();
          e.stopPropagation();
          tip.style.display = 'none';

          if (isEditableTextField(el, lbl)) {
            activate(el, lbl);
          } else {
            // Images, links, boolean/url fields, form controls → jump to field panel.
            postToParent({ type: 'get:field-click', label: lbl });
          }
        }, true);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupClickToEdit);
      } else {
        setupClickToEdit();
      }
    }

    // ── Smart Watcher (SPA-aware) ────────────────────────────────────────
    // The original scanner ran applyContent() once on page load. That
    // breaks every modern SPA (React/Vue/Svelte/etc) because the elements
    // tagged with data-get-key don't exist yet at DOMContentLoaded — they
    // mount milliseconds later when the framework hydrates, and the
    // scanner has already given up by then.
    //
    // The MutationObserver below watches the document for *any* new
    // [data-get-key] elements appearing (or existing ones being replaced)
    // and re-applies the cached content. Debounced ~150ms so a burst of
    // React renders only triggers one re-apply.
    function startSmartWatcher() {
      if (typeof MutationObserver === 'undefined') return;
      var pending = false;
      // Self-trigger guard: applyContent() mutates the DOM (textContent /
      // innerHTML on tagged elements). Without this flag, the observer
      // would see those mutations, schedule another reapply, mutate again,
      // and loop forever (debounced but still wasteful). We disconnect
      // before applying, then take and discard the noise records before
      // reconnecting so we never observe our own writes.
      function reapply() {
        pending = false;
        if (!latestContent) return;
        try { observer.disconnect(); } catch (e) {}
        try { applyContent(latestContent); } catch (e) {}
        try { observer.takeRecords(); } catch (e) {}
        attach();
      }
      var observer = new MutationObserver(function(mutations) {
        if (pending || !latestContent) return;
        // Pre-filter: only schedule when a tagged element could be
        // newly present. We check addedNodes for [data-get-key] descendants
        // and attribute changes on tagged elements. Plain text edits
        // inside an already-tagged element are ignored — they never need
        // a reapply.
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          if (m.type === 'attributes') { pending = true; break; }
          if (m.addedNodes && m.addedNodes.length > 0) {
            for (var j = 0; j < m.addedNodes.length; j++) {
              var n = m.addedNodes[j];
              if (n.nodeType !== 1) continue; // skip text/comment
              if (n.hasAttribute && n.hasAttribute('data-get-key')) { pending = true; break; }
              if (n.querySelector && n.querySelector('[data-get-key]')) { pending = true; break; }
            }
            if (pending) break;
          }
        }
        if (pending) setTimeout(reapply, 150);
      });
      function attach() {
        if (!document.body) { setTimeout(attach, 50); return; }
        observer.observe(document.body, {
          childList: true, subtree: true,
          attributes: true, attributeFilter: ['data-get-key'],
        });
      }
      attach();
    }
    startSmartWatcher();
  })();

})();
`;

export default router;
