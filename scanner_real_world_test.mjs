// Real-world scanner test using jsdom against live public sites.
// Loads each site's HTML, runs the scanner extraction logic, reports captured content.
//
// LIMITATION: jsdom does not execute the site's JavaScript. So this measures
// what the scanner gets from the *server-rendered* HTML only — the same baseline
// a customer would get if their site were not JS-heavy.
// In a real browser, the scanner's new 3s delayed re-scan would catch
// async-rendered content too.

import { JSDOM, VirtualConsole } from "jsdom";

const SITES = [
  "https://example.com/",
  "https://www.iana.org/help/example-domains",
  "https://news.ycombinator.com/",
  "https://stripe.com/",
  "https://tailwindcss.com/",
];

async function fetchScannerSrc() {
  const r = await fetch("http://localhost:8080/api/public/scanner.js");
  return await r.text();
}

async function fetchSite(url) {
  const r = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return await r.text();
}

async function runOne(url, scannerSrc) {
  const html = await fetchSite(url);
  const vc = new VirtualConsole(); // suppress jsdom's console noise
  const dom = new JSDOM(html, {
    url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: vc,
  });
  const { window } = dom;
  // Make a fake script tag so the scanner can find itself.
  const fake = window.document.createElement("script");
  fake.src = "http://localhost:8080/api/public/scanner.js";
  fake.setAttribute("data-key", "pk_realworldtest_synth");
  window.document.body.appendChild(fake);
  // Intercept fetch to capture the snapshot body.
  let captured = null;
  window.fetch = async (u, opts) => {
    if (typeof u === "string" && u.indexOf("/api/public/content/snapshot") !== -1) {
      try {
        captured = JSON.parse(opts.body);
      } catch {}
    }
    return { ok: true, status: 200, json: async () => ({}), text: async () => "" };
  };
  // Run the scanner script in this window.
  window.eval(scannerSrc);
  // Wait briefly to let the script's microtasks run (and the 3s delayed scan would
  // overwrite captured if jsdom timers ran — we don't wait that long here).
  await new Promise((r) => setTimeout(r, 50));
  return captured;
}

function summarize(url, snap) {
  if (!snap) {
    return { url, error: "scanner produced no snapshot" };
  }
  const sections = snap.sections || [];
  const totalFields = sections.reduce((n, s) => n + (s.fields?.length || 0), 0);
  const byType = {};
  const headings = [];
  const bodyLines = [];
  const ctas = [];
  const images = [];
  for (const s of sections) {
    for (const f of s.fields || []) {
      const t = (f.type || "").toLowerCase();
      byType[t] = (byType[t] || 0) + 1;
      if (t === "text" && headings.length < 5) headings.push(f.value);
      if (t === "richtext" && bodyLines.length < 3) {
        const lines = (f.value || "").split("\n").slice(0, 2);
        for (const l of lines) {
          if (bodyLines.length < 3) bodyLines.push(l.slice(0, 140));
        }
      }
      if ((t === "link" || t === "button" || t === "url") && ctas.length < 5)
        ctas.push((f.label || "") + " → " + (f.value || ""));
      if (t === "image" && images.length < 5) images.push(f.value);
    }
  }
  return {
    url,
    sections: sections.length,
    totalFields,
    byType,
    sectionNames: sections.map((s) => s.name),
    sampleHeadings: headings,
    sampleBodyLines: bodyLines,
    sampleCtas: ctas,
    sampleImages: images,
  };
}

(async () => {
  const scannerSrc = await fetchScannerSrc();
  console.log("Loaded scanner.js bytes:", scannerSrc.length);
  console.log();
  for (const site of SITES) {
    let snap;
    try {
      snap = await runOne(site, scannerSrc);
    } catch (e) {
      console.log("==== " + site + " ====");
      console.log("ERROR:", e.message);
      console.log();
      continue;
    }
    const s = summarize(site, snap);
    console.log("==== " + site + " ====");
    if (s.error) {
      console.log("ERROR:", s.error);
    } else {
      console.log("Sections:", s.sections, "(" + s.sectionNames.slice(0, 8).join(", ") + ")");
      console.log("Total fields:", s.totalFields);
      console.log("By type:", s.byType);
      if (s.sampleHeadings.length)
        console.log("Sample headings:");
      for (const h of s.sampleHeadings) console.log("   - " + h);
      if (s.sampleBodyLines.length)
        console.log("Sample body lines:");
      for (const l of s.sampleBodyLines) console.log("   - " + l);
      if (s.sampleCtas.length)
        console.log("Sample CTAs:");
      for (const c of s.sampleCtas) console.log("   - " + c);
      if (s.sampleImages.length)
        console.log("Sample images:");
      for (const i of s.sampleImages) console.log("   - " + i);
    }
    console.log();
  }
})();
