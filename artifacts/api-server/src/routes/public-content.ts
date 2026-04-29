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
    fetch(CONTENT_URL, {
      headers: { 'Authorization': 'Bearer ' + key }
    })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) { if (data && data.content) applyContent(data.content); })
    .catch(function() {});
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

  // ── Main scan ─────────────────────────────────────────────────────────────

  var seenText, seenImages, seenCtaText;

  function scan() {
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
})();
`;

export default router;
