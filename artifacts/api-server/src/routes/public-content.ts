import { Router, type IRouter } from "express";
import { db, contentFieldsTable, contentSnapshotsTable } from "@workspace/db";
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

  res.json({ ok: true });
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
  // Locate our script tag by src pattern so it works without defer/async.
  var scriptEl = document.querySelector('script[src*="scanner.js"][data-key]');
  if (!scriptEl) {
    console.warn('[get] Scanner script not found or missing data-key attribute.');
    return;
  }
  var key = scriptEl.getAttribute('data-key');
  if (!key || !key.startsWith('pk_')) {
    console.warn('[get] Invalid data-key on scanner script.');
    return;
  }
  // Derive the API endpoint from the script's own origin.
  var origin = new URL(scriptEl.src).origin;
  var SNAPSHOT_URL = origin + '/api/public/content/snapshot';

  // ── Helpers ────────────────────────────────────────────────────────────────

  function clean(s) {
    return (s || '').replace(/\\s+/g, ' ').trim();
  }

  function absUrl(href) {
    if (!href) return null;
    if (href.startsWith('http://') || href.startsWith('https://')) return href;
    if (href.startsWith('//')) return 'https:' + href;
    if (href.startsWith('/')) return location.origin + href;
    return location.origin + '/' + href;
  }

  var KEYWORDS = {
    hero: 'Hero', banner: 'Hero', jumbotron: 'Hero',
    about: 'About', story: 'About', mission: 'About',
    services: 'Services', offerings: 'Services',
    features: 'Features',
    how: 'How It Works', process: 'How It Works', steps: 'How It Works',
    team: 'Team', staff: 'Team', people: 'Team',
    testimonial: 'Testimonials', reviews: 'Testimonials',
    pricing: 'Pricing', plans: 'Pricing',
    faq: 'FAQ', questions: 'FAQ',
    contact: 'Contact',
    footer: 'Footer',
    cta: 'Call to Action'
  };

  function inferName(el) {
    var id = (el.id || '').toLowerCase();
    var cls = (el.className || '').toLowerCase();
    var aria = el.getAttribute('aria-label');
    if (aria) return aria;
    for (var kw in KEYWORDS) {
      if (id.indexOf(kw) >= 0 || cls.indexOf(kw) >= 0) return KEYWORDS[kw];
    }
    return null;
  }

  // ── Section extractor ──────────────────────────────────────────────────────

  var seenText, seenImages;

  function extractSection(el, name) {
    var fields = [];

    // Primary heading
    var headings = el.querySelectorAll('h1,h2,h3,h4');
    var primaryH = null;
    for (var i = 0; i < headings.length; i++) {
      var ht = clean(headings[i].textContent);
      if (ht && ht.length <= 200 && !seenText.has(ht)) {
        seenText.add(ht);
        fields.push({ label: name + ' Heading', type: 'text', value: ht });
        primaryH = headings[i];
        break;
      }
    }

    // Sub-heading (h3/h4, different from primary)
    var subHs = el.querySelectorAll('h3,h4');
    for (var si = 0; si < subHs.length; si++) {
      if (subHs[si] === primaryH) continue;
      var st = clean(subHs[si].textContent);
      if (st && st.length <= 200 && !seenText.has(st)) {
        seenText.add(st);
        fields.push({ label: name + ' Sub-heading', type: 'text', value: st });
        break;
      }
    }

    // Body paragraphs
    var paras = el.querySelectorAll('p');
    var bodyParts = [];
    for (var pi = 0; pi < paras.length; pi++) {
      var pt = clean(paras[pi].textContent);
      if (pt.length >= 20 && !seenText.has(pt)) {
        seenText.add(pt);
        bodyParts.push(pt);
      }
    }
    if (bodyParts.length) {
      fields.push({ label: name + ' Body', type: 'richtext', value: bodyParts.join('\\n\\n') });
    }

    // CTA — first button or link with short text
    var links = el.querySelectorAll('a[href],button');
    for (var li = 0; li < links.length; li++) {
      var lt = clean(links[li].textContent);
      if (lt.length >= 2 && lt.length <= 60) {
        var href = links[li].getAttribute('href');
        var abs = href ? absUrl(href) : null;
        if (abs && abs.indexOf('#') < 0 && !seenText.has(abs)) {
          seenText.add(abs);
          fields.push({ label: name + ' CTA', type: 'url', value: abs });
        }
        break;
      }
    }

    // First image in section
    var imgs = el.querySelectorAll('img[src]');
    for (var ii = 0; ii < imgs.length; ii++) {
      var src = imgs[ii].getAttribute('src');
      if (!src || src.startsWith('data:') || src.startsWith('blob:')) continue;
      var absSrc = absUrl(src);
      if (absSrc && !seenImages.has(absSrc)) {
        seenImages.add(absSrc);
        fields.push({ label: name + ' Image', type: 'image', value: absSrc });
        break;
      }
    }

    return fields;
  }

  // ── Main scan ──────────────────────────────────────────────────────────────

  function scan() {
    seenText = new Set();
    seenImages = new Set();
    var sections = [];
    var usedNames = {};

    // Primary pass: semantic / named containers
    var candidates = document.querySelectorAll(
      'section, article, [class*="section"], [class*="block"], [id]'
    );

    var cArr = Array.prototype.slice.call(candidates).filter(function (el) {
      var depth = 0, p = el.parentElement;
      while (p) {
        var tag = (p.tagName || '').toUpperCase();
        if (tag === 'SECTION' || tag === 'ARTICLE') depth++;
        p = p.parentElement;
      }
      return depth <= 1;
    });

    for (var i = 0; i < cArr.length && sections.length < 10; i++) {
      var el = cArr[i];
      var name = inferName(el);
      if (!name) {
        var fh = el.querySelector('h1,h2,h3');
        if (fh) {
          var ft = clean(fh.textContent);
          if (ft && ft.length <= 60) name = ft;
        }
      }
      if (!name) continue;

      var count = usedNames[name] || 0;
      usedNames[name] = count + 1;
      var displayName = count === 0 ? name : name + ' ' + (count + 1);

      var fields = extractSection(el, displayName);
      if (fields.length > 0) sections.push({ name: displayName, fields: fields });
    }

    // Fallback: group by headings
    if (sections.length === 0) {
      var hEls = document.querySelectorAll('h1,h2,h3');
      for (var hi = 0; hi < hEls.length && sections.length < 8; hi++) {
        var hText = clean(hEls[hi].textContent);
        if (!hText || hText.length > 200 || seenText.has(hText)) continue;
        seenText.add(hText);
        var sname = hText.length <= 40 ? hText : hText.slice(0, 40) + '\\u2026';
        var sfields = [{ label: sname + ' Heading', type: 'text', value: hText }];
        var sib = hEls[hi].nextElementSibling;
        var lim = 5, bodyP = [];
        while (sib && lim-- > 0) {
          if (/^H[1-4]$/.test(sib.tagName)) break;
          var sibT = clean(sib.textContent);
          if (sibT.length >= 20 && !seenText.has(sibT)) {
            seenText.add(sibT);
            bodyP.push(sibT);
          }
          sib = sib.nextElementSibling;
        }
        if (bodyP.length) sfields.push({ label: sname + ' Body', type: 'richtext', value: bodyP.join('\\n\\n') });
        sections.push({ name: sname, fields: sfields });
      }
    }

    // Last resort: title + meta description
    if (sections.length === 0) {
      var title = clean(document.title);
      var metaEl = document.querySelector('meta[name="description"]');
      var desc = metaEl ? clean(metaEl.getAttribute('content')) : '';
      var lf = [];
      if (title) lf.push({ label: 'Page Title', type: 'text', value: title });
      if (desc) lf.push({ label: 'Page Description', type: 'richtext', value: desc });
      if (lf.length) sections.push({ name: 'Page', fields: lf });
    }

    return sections;
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  function sendSnapshot() {
    var sections = scan();
    if (!sections.length) return;
    fetch(SNAPSHOT_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sections: sections, pageUrl: location.href })
    }).catch(function () {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendSnapshot);
  } else {
    sendSnapshot();
  }
})();
`;

export default router;
