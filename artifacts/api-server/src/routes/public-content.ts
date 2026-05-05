import { Router, type IRouter, type Request } from "express";
import { db, contentFieldsTable, contentSnapshotsTable, projectsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireProjectKey, type ProjectKeyRequest } from "../middlewares/project-key-auth";

const router: IRouter = Router();

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

  const rawSeed = req.body?.seed;
  const seed: Record<string, string> = {};
  if (rawSeed && typeof rawSeed === "object" && !Array.isArray(rawSeed)) {
    for (const [label, val] of Object.entries(rawSeed)) {
      if (typeof val === "string" && val.trim() !== "") {
        seed[label] = val;
      }
    }
  }

  const fields = await db
    .select()
    .from(contentFieldsTable)
    .where(eq(contentFieldsTable.projectId, projectId));

  const toSeed = fields.filter(
    (f) => (f.value == null || f.value === "") && seed[f.label] != null,
  );

  if (toSeed.length > 0) {
    await Promise.all(
      toSeed.map((f) =>
        db
          .update(contentFieldsTable)
          .set({ value: seed[f.label] })
          .where(eq(contentFieldsTable.id, f.id)),
      ),
    );
    for (const f of toSeed) {
      (f as any).value = seed[f.label];
    }
  }

  recordPing(projectId, req);
  res.json({ projectId: String(projectId), content: buildContentMap(fields) });
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
  const rawSections = req.body?.sections;
  const pageUrl: string | undefined = typeof req.body?.pageUrl === "string"
    ? req.body.pageUrl
    : undefined;

  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    return res.status(400).json({ error: "sections must be a non-empty array" });
  }

  await db
    .insert(contentSnapshotsTable)
    .values({
      projectId,
      sections: rawSections as any,
      pageUrl: pageUrl ?? null,
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
router.get("/scanner.js", (_req, res) => {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.send(SCANNER_SCRIPT);
});

// ── Scanner script (vanilla JS, no deps) ─────────────────────────────────────

const SCANNER_SCRIPT = /* javascript */ `
(function () {
  var scriptEl = document.querySelector('script[src*="scanner.js"][data-key]');
  if (!scriptEl) { console.warn('[get] Scanner: missing script tag or data-key.'); return; }
  var key = scriptEl.getAttribute('data-key');
  if (!key || !key.startsWith('pk_')) { console.warn('[get] Scanner: invalid data-key.'); return; }

  var origin = new URL(scriptEl.src).origin;
  var SNAPSHOT_URL = origin + '/api/public/content/snapshot';
  var CONTENT_URL  = origin + '/api/public/content';

  // ── Content injection ─────────────────────────────────────────────────────
  // Fetches the project's published field values and writes them into any
  // element that carries a [data-get-key="Field Label"] attribute.
  //
  // Type rules:
  //   image  → img.src; background-image on non-img elements
  //   url    → element.href (works on <a>)
  //   text / richtext / number / anything else → element.textContent
  //
  // Fire-and-update: we never block the initial render. Default content in the
  // HTML shows first, then swaps as soon as the fetch resolves (typically one
  // network round-trip on the same origin).

  function applyContent(content) {
    for (var label in content) {
      var field = content[label];
      var value = field.value;
      if (value == null || value === '') continue;
      var type = field.type;
      // Escape double-quotes in the label so it's safe inside the CSS attribute
      // selector. All other characters are fine as-is for the labels we produce.
      var sel = '[data-get-key="' + label.replace(/"/g, '\\"') + '"]';
      var els = document.querySelectorAll(sel);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (type === 'image') {
          if (el.tagName === 'IMG') {
            el.src = value;
          } else {
            el.style.backgroundImage = 'url("' + value.replace(/"/g, '\\"') + '")';
          }
        } else if (type === 'url') {
          if ('href' in el) { el.href = value; } else { el.setAttribute('href', value); }
        } else {
          el.textContent = value;
        }
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
    .then(function(r) { return r.ok ? r.json() : null; })
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
      hIdx++;
    }

    // ── Body text — every visible paragraph-like element ─────────────────
    // We grab text from p, li, blockquote, figcaption, td, th, dd individually
    // so the order follows the DOM. Each unique run becomes a line.
    var bodyEls = el.querySelectorAll(
      'p, li, blockquote, figcaption, td, th, dd, [class*="desc"], [class*="text"], [class*="copy"], [class*="caption"]'
    );
    var bodyLines = [];
    for (var bi = 0; bi < bodyEls.length; bi++) {
      // Skip if it contains a heading (the heading already captured above)
      if (bodyEls[bi].querySelector('h1,h2,h3,h4,h5,h6')) continue;
      var bt = clean(bodyEls[bi].textContent);
      if (bt.length < 3 || seenText.has(bt)) continue;
      seenText.add(bt);
      bodyLines.push(bt);
    }
    if (bodyLines.length) {
      fields.push({ label: sectionName + ' Body', type: 'richtext', value: bodyLines.join('\\n') });
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

        // Collect all text siblings until next heading
        var sib = hEls[hi].nextElementSibling;
        var lim = 20, bodyLines = [];
        while (sib && lim-- > 0) {
          if (/^H[1-6]$/.test(sib.tagName)) break;
          var textNodes = [];
          collectText(sib, textNodes);
          for (var ti = 0; ti < textNodes.length; ti++) {
            var tv = textNodes[ti];
            if (tv.length >= 2 && !seenText.has(tv)) {
              seenText.add(tv);
              bodyLines.push(tv);
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
        if (bodyLines.length) sfields.push({ label: sname + ' Body', type: 'richtext', value: bodyLines.join('\\n') });
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
        if (!msg || msg.type !== 'get:highlight') return;
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

        // Walk up from the event target to the nearest [data-get-key] ancestor
        function nearestKey(target) {
          var el = target;
          for (var lim = 0; el && lim < 10; lim++, el = el.parentElement) {
            if (el.hasAttribute && el.hasAttribute('data-get-key')) return el;
          }
          return null;
        }

        // Show tooltip on hover
        document.addEventListener('mouseover', function(e) {
          var el = nearestKey(e.target);
          if (!el) { tip.style.display = 'none'; return; }
          var lbl = el.getAttribute('data-get-key') || '';
          tip.textContent = 'Click to edit: ' + lbl;
          var rect = el.getBoundingClientRect();
          tip.style.display = 'block';
          // Prefer showing above; fall back to below if too close to top edge
          var tipTop = rect.top - 34;
          if (tipTop < 6) tipTop = rect.bottom + 6;
          tip.style.top = tipTop + 'px';
          tip.style.left = Math.max(4, Math.min(rect.left, window.innerWidth - 220)) + 'px';
        });

        // Hide tooltip on mouseout
        document.addEventListener('mouseout', function(e) {
          if (nearestKey(e.target)) tip.style.display = 'none';
        });

        // Intercept click — use capture phase to run before any site handlers
        // (important for tagged <a> elements that would otherwise navigate)
        document.addEventListener('click', function(e) {
          var el = nearestKey(e.target);
          if (!el) return;
          e.preventDefault();
          e.stopPropagation();
          tip.style.display = 'none';
          var lbl = el.getAttribute('data-get-key') || '';
          try { window.parent.postMessage({ type: 'get:field-click', label: lbl }, '*'); } catch(e4) {}
        }, true);
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupClickToEdit);
      } else {
        setupClickToEdit();
      }
    }
  })();

})();
`;

export default router;
