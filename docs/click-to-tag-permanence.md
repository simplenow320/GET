# Click-to-Tag Permanence — Spec

Status: proposal · Owner: get · Last updated: 2026-05-23

## The problem

When a client uses "+ Make editable" in the get editor, we write
`data-get-key="…"` into the iframe's DOM and create a matching CMS
field. The CMS field persists; the DOM attribute does not. On the next
production page load there is no tag, so the scanner has nothing to
swap content into. Today the only way to make a tag stick in
production is for a developer to hand-edit the source and redeploy.

This spec closes that gap.

## Goal

A non-technical client can tag any element on a live site and see
their content updates appear on production within seconds, with no
developer involvement and no redeploy — and when something does drift
(refactor, markup change), the system tells the developer in plain
English and offers a one-click fix.

## Non-goals

- Visual style editing (colors, layout). Tagging is content-only.
- A WYSIWYG that owns the entire page. We tag specific elements; the
  rest of the site is the developer's.
- Auto-merging code without human review.

## Design — hybrid model

Two layers, in priority order:

1. **Runtime selector mapping (primary path).** get stores a list of
   `{ fieldId, selector }` pairs per project. On every page load, the
   scanner walks the list and writes `data-get-key="<label>"` onto
   any matching element before it does its normal content swap. This
   means a tag created in the editor is live in production on the
   visitor's next page load. No source edit, no redeploy.

2. **Source-of-truth promotion (secondary path).** When the
   developer is ready to "harden" a project, they can promote
   selector mappings into real `data-get-key` attributes in their
   source code — either by copying a snippet or by accepting an
   auto-generated PR. Promoted tags no longer rely on selectors, so
   refactors won't detach them.

A field can be in one of three states at any time:

| State        | Meaning                                                              |
|--------------|----------------------------------------------------------------------|
| `inSource`   | A real `data-get-key` exists in shipped HTML. Most durable.          |
| `runtime`    | Selector mapping is applied at runtime. Works without redeploy.      |
| `detached`   | Selector no longer matches anything on the page. Needs attention.    |

The editor's left panel shows a colored dot per field (green / yellow
/ red) reflecting this state. (This replaces the earlier "health dot"
idea — same UI, real data behind it.)

## Selector strategy

The selector we store has to survive ordinary frontend churn. We use
a layered resolver, picking the first that uniquely matches:

1. **Stable IDs and test ids:** `#hero-title`, `[data-testid="hero-title"]`.
2. **Semantic anchors:** `main h1:first-of-type`, `header nav a:nth-child(1)`.
3. **Structural path with text fingerprint:** `body > main > section:nth-of-type(2) > h2` + a SHA-1 of the original text content as a tiebreaker.
4. **Fallback:** absolute nth-child CSS path.

The tagger captures all four at creation time and stores them as an
ordered list. The runtime resolver tries each in order and uses the
first that returns exactly one element. If none resolve, the field
goes to `detached` and surfaces in the dashboard.

## Drift detection

Every time the scanner loads a page, after applying mappings it
reports back to the API:

```
POST /api/public/scanner/heartbeat
{ projectKey, pageUrl, resolved: ["App name", "Hero CTA"],
  detached: ["Footer copy"] }
```

The server stores per-field last-resolved timestamps. If a field has
been `runtime` and now goes `detached`, we:

- Mark the field `detached` in the dashboard.
- Email the project owner once per drift event (debounced 24h).
- Offer two actions: "remap" (re-tag visually) and "promote to source"
  (copy snippet or open PR).

## Promotion to source

Two options, ordered by lift.

### Option A — Copy snippet (ship first)

In the field's row in the editor, a "Make permanent" button shows:

```
Add this to your source so the tag survives refactors:

  <h1 data-get-key="Hero title"> … </h1>

Selector: main > h1:first-of-type
File hint: search your codebase for the text "Plan events that don't suck."
```

We can show the text fingerprint so devs can grep for it. Zero
infrastructure required. Honest about what we know and don't.

### Option B — Auto-PR via GitHub (ship later)

If the project is connected to GitHub:

1. We resolve the selector → text fingerprint pair to a source file
   using ripgrep across the connected repo.
2. We open a PR adding the `data-get-key` attribute to that element.
3. Supported stacks at v1: plain HTML, Vite + React (JSX), Next.js
   (JSX). Anything else falls back to Option A.

Limits we should be upfront about:
- Components reused in many places: we don't auto-PR; we show the
  snippet and the list of files where the text occurs, dev picks.
- Server-rendered or compiled-away markup (e.g. MDX, CMS partials):
  Option A only.

## API additions

```
POST /api/projects/:projectId/tags
  body: { fieldId, selectors: string[], textFingerprint: string,
          createdFromUrl: string }
  → 201 { tagId }

GET  /api/projects/:projectId/tags
  → [{ tagId, fieldId, selectors, textFingerprint, state,
       lastResolvedAt, lastSeenUrl }]

DELETE /api/projects/:projectId/tags/:tagId

POST /api/public/scanner/heartbeat  (public, project-key scoped)
  body: { pageUrl, resolved: string[], detached: string[] }

GET  /api/public/content/tags?key=pk_…
  → [{ label, selectors, textFingerprint }]
```

Scanner fetches `tags` alongside `content` on first run and caches it
for the same TTL.

## Scanner changes (the only runtime change)

Pseudocode of the new hot path:

```
const [content, tags] = await Promise.all([fetchContent(), fetchTags()]);
for (const tag of tags) {
  const el = resolveFirstMatch(tag.selectors, tag.textFingerprint);
  if (el && !el.hasAttribute('data-get-key')) {
    el.setAttribute('data-get-key', tag.label);
  }
}
applyContent(content);  // existing code — unchanged
observeMutations();     // SPA-aware re-apply
sendHeartbeat({ resolved, detached });
```

`applyContent` and the bridge to the editor are untouched. This keeps
the change well-scoped and reversible.

## Data model

```
tags
  id              uuid pk
  project_id      uuid fk → projects
  field_id        uuid fk → content_fields
  selectors       jsonb   -- ordered array of selector strings
  text_fp         text    -- SHA-1 of original textContent
  created_from    text    -- URL where tag was created
  created_at      timestamptz
  last_resolved_at timestamptz null
  last_seen_url   text null
  state           text   -- 'inSource' | 'runtime' | 'detached'
```

One field can have multiple tags (same field shown on multiple pages
or in multiple components). That's fine — they're additive.

## Failure modes & how we handle them

| Failure                              | Behavior                                                                 |
|--------------------------------------|--------------------------------------------------------------------------|
| Selector matches >1 element          | Skip (don't apply). Mark `detached`. Show "ambiguous" in dashboard.      |
| Selector matches 0 elements          | Try next selector in list, then fingerprint search, then `detached`.     |
| Page has CSP that blocks our script  | Existing failure mode — out of scope.                                    |
| Client tags inside a Shadow DOM      | v1: not supported. v2: we walk shadow roots in the resolver.             |
| Auto-PR can't locate source file     | Fall back to copy-snippet UI silently.                                   |

## Rollout plan

Ship in order, each shippable on its own:

1. **Tags table + scanner runtime mapping + create-tag endpoint.**
   Click-to-tag becomes durable across page loads, without source
   edits. This alone closes the "doesn't survive production" gap.
2. **Heartbeat + drift detection + dashboard states.** Owners see
   field health and get notified when something detaches.
3. **Copy-snippet promotion UI.** One button per field.
4. **Auto-PR for plain HTML repos.** Smallest scope, biggest demo.
5. **Auto-PR for Vite+React, then Next.js.**

## What we are explicitly *not* doing in v1

- Editing CSS or layout.
- Granting clients access to anything other than `data-get-key`'d
  text and images.
- Storing arbitrary HTML — `xss({ whiteList: {} })` still applies to
  every user-supplied value.

## Open questions

1. Heartbeats from every visitor pageview is a lot of traffic. Sample
   at 1% in v1? Or only run on a known editor/owner session?
2. Should `inSource` be auto-detected (scanner reports which elements
   already had the attribute on first paint) or set explicitly by
   promotion? Auto-detect is nicer UX; explicit is easier to reason
   about. Recommend: auto-detect, with a manual override.
3. Multi-tenant selector hits: if a developer reuses a component
   across pages, do we want one tag per occurrence or one tag that
   matches everywhere? Recommend: one tag, matches everywhere, with
   per-URL preview in the dashboard.
