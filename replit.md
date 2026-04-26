# get SaaS

## Overview

Full-stack SaaS called "get" — a hosted control plane that lets developers give their clients safe visual content editing access without breaking the app. Built for vibe coders who build in Replit.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui (artifacts/get-saas)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Router**: wouter

## Product Structure

### Public Pages
- `/` — Landing page with brand logo hero, tagline, benefits, how it works, CTA
- `/login` — Login form
- `/signup` — Signup form

### Authenticated App Pages (/app/*)
- `/app/dashboard` — Project stats overview
- `/app/projects` — All projects grid with create/manage
- `/app/projects/:projectId` — Project detail with tabs: Content, Clients, Domains, Drafts, API keys, Activity, Settings (tabs scroll horizontally on mobile via `no-scrollbar`)
- `/accept-invite/:token` — Client invite acceptance landing
- `/app/setup/:projectId` — Multi-step setup wizard
- `/app/editor/:projectId` — Client-facing content editor (white-label, no branding)

## Critical infrastructure notes
- `/api/public/*` routes (scanner.js, content snapshot POST, public content reads) are intentionally embeddable from any origin. They use a permissive CORS config AND override helmet's default `Cross-Origin-Resource-Policy: same-site` to `cross-origin`. Without this override, third-party customer pages get `ERR_BLOCKED_BY_RESPONSE.NotSameSite` when loading `<script src=".../api/public/scanner.js">`. Do NOT add sensitive endpoints under `/api/public/*` — anything mounted there inherits the embeddable posture. Auth on those routes uses `Authorization: Bearer pk_*` (project key) via `requireProjectKey`.

## Brand rules (strict)
- **Three brand assets** (transparent PNGs, all in `attached_assets/`):
  1. `f6f59ad9-...png` — wordmark + mascot + tagline. The "full" hero asset. Tagline is only legible at ~400px+ wide.
  2. `d00d5786-...png` — wordmark + mascot, no tagline. The "compact" auth/utility variant.
  3. `17d6aa3a-...png` — just the mascot. Used as a friendly accent (exported as `mascotPath`).
- Render the logo via `<BrandLogo variant="full" | "compact" />` from `src/lib/ui.tsx` (compact is the default). NEVER recreate the wordmark or mascot programmatically (no fake `<Wordmark>` text component, no SVG copies).
- **Landing page**: hero uses `<BrandLogo variant="full" />`, no top nav, no header links, no tiny corner logo, no secondary brand marks, no footer brand mark. Tagline lives baked into the full asset and is mirrored as an sr-only H1: "Let clients edit your app without breaking it." (no em-dash). One additional mascot accent appears next to the "How it works" steps.
- **Auth pages (/login, /signup) and /not-found**: compact BrandLogo (≤140px) — never the full asset, the tagline becomes unreadable.
- **Authenticated product UI (/app/\*)**: WHITE-LABEL. No BrandLogo, no get-branded copy. The ONLY mascot exception inside /app is the dashboard "No projects yet" empty state, which uses `mascotPath` via `<EmptyState image={mascotPath} />` to make first-run feel friendly. Sidebar header still shows uppercase "Workspace". Setup top bar shows "Set up project". Editor top bar shows "Editor".
- `GET_PROJECT_KEY` env var name is allowed in code snippets — it's the developer-facing API contract identifier (like `STRIPE_SECRET_KEY`), not branding.
- **Landing palette**: Warm cream (#faf9f6), dark navy (#1a1a2e), yellow accent (#FFD747)
- **App palette**: White-label, clean grayscale, navy primary buttons

## Shared UI primitives (`src/lib/ui.tsx`)
All pages import design tokens (`BRAND`, `tone`, `line`, `type`, `r`, `ease`, `status`) and components (`PrimaryButton`, `SecondaryButton`, `GhostButton`, `DangerButton`, `Card`, `PageHeader`, `SectionTitle`, `EmptyState`, `Pill`, `Field`, `BrandLogo`, `PageContainer`, `ConfirmDialog`) from this module. When adding new pages, reuse these instead of inventing one-off styles. `Field` auto-generates an `id` for its child input and wires `htmlFor` on the label. `ConfirmDialog` wraps Radix AlertDialog with brand styling — use it for ALL destructive confirmations (delete, revoke, etc.). Never use native `confirm()` / `alert()`.

## Auth
Session-based auth using scrypt password hashing + random session tokens (SHA-256 hashed at rest in the `sessions` table). The session token is set as an **httpOnly, Secure, SameSite=Lax cookie** named `gs` (30-day TTL). The frontend never reads or stores the raw token — `lib/api-client-react/src/custom-fetch.ts` sets `credentials: "include"` so the browser attaches it automatically. Bearer-token auth is still accepted for non-browser/CLI clients. RBAC is enforced backend-side via `requireProjectAccess(minRole)` middleware.

### Sign in with Google
"Continue with Google" button on `/login` and `/signup` triggers a top-level GET to `/api/auth/google`. Routes live in `artifacts/api-server/src/routes/oauth-google.ts` with helpers in `lib/oauth-google.ts` (no `google-auth-library` dep — direct fetches against `oauth2.googleapis.com/token` and `openidconnect.googleapis.com/v1/userinfo`). Flow uses HMAC-signed state (key = `SESSION_SECRET`) **plus PKCE S256**: a per-attempt 256-bit verifier is generated, the SHA-256 challenge is sent to Google, and the verifier is stashed alongside state in a `gs_oauth_state` HttpOnly cookie (`<state>:<verifier>`). The callback unpacks both, validates state, then sends `code_verifier` to the token endpoint — binding the auth code to the originating browser even if it's intercepted in transit.

### Forgot-password (no enumeration)
`POST /auth/forgot-password` always returns `200 {"ok":true}` with **identical wall-clock latency** for the existing-email and unknown-email branches. Implemented as a 350ms minimum response floor (`MIN_FORGOT_PASSWORD_RESPONSE_MS` in `routes/auth.ts`) — the timer starts at handler entry, before any DB work, and any remaining time is awaited via `setTimeout` before sending the response. This swamps the cost difference between the existing-user branch (extra UPDATE + INSERT + queued SendGrid call) and the unknown-user branch (single SELECT), so an attacker can't distinguish the two by timing the endpoint.

Flow:
1. `GET /api/auth/google?next=...` mints an HMAC-signed `state = nonce.next.hmac(SESSION_SECRET)`, sets it in a 10-minute httpOnly `gs_oauth_state` cookie, and 302s to Google's authorize endpoint with `scope=openid email profile`.
2. `GET /api/auth/google/callback` verifies that the cookie state == query state == valid HMAC, exchanges the code for an access token, fetches userinfo, refuses unverified emails (`email_verified=false`), then either looks up by `google_sub` → falls back to email match (and links `google_sub`) → falls back to creating a new passwordless user. Issues the same `gs` session cookie as password login and 302s to the validated `next` path.

Friendly error codes surfaced to `/login?error=...`: `oauth_cancelled`, `oauth_state`, `oauth_exchange`, `oauth_unverified`, `oauth_unavailable`. The login page reads them once on mount, shows a destructive toast, and strips the param.

`users.password_hash` is **nullable** (Google-only users have no password — they can set one later via `/forgot-password`). `users.google_sub` is a unique nullable text column carrying the OIDC `sub` so we link by stable identifier rather than email (which can change in Google).

### CSRF defense (defense in depth)
1. **SameSite=Lax** on the session cookie blocks most cross-site form/fetch CSRF.
2. **Origin-header gate** in `app.ts` runs on every mutating request (POST/PUT/PATCH/DELETE outside `/api/public/*`). It hardens against the case where Replit's edge proxy rewrites `SameSite=Lax` to `None` for iframe contexts. Rules: allowlisted Origin → pass; missing Origin + no session cookie → pass (curl/Bearer client); everything else → 403 "Bad origin".
3. **CORS allowlist** is explicit (REPLIT_DEV_DOMAIN, APP_BASE_URL, localhost) — never wildcards on shared hosting domains. Disallowed origins receive no `Access-Control-Allow-Origin` (soft reject via `cb(null, false)`), so browsers cannot read responses.
4. **XSS hardening**: every user-supplied string is run through `xss({ whiteList: {} })` in `lib/sanitize.ts` before persistence; the frontend renders no user-generated HTML and uses no `dangerouslySetInnerHTML`.

### Token storage
Every share-equivalent credential is stored as a SHA-256 hash, never plaintext:
- **Sessions** (`sessions.token`) — hashed; raw token only in the `gs` cookie.
- **Project keys** (`project_keys.key_hash`) — hashed; raw `pk_…` returned once at creation.
- **Password reset tokens** (`password_reset_tokens.token`) — hashed; raw token only in the email link.
- **Invite tokens** (`invites.token` — DB column kept for migration safety, JS field is `tokenHash`) — hashed; raw token returned ONCE in the create response and embedded in the invite email. List endpoints always return `token: null`. Re-invite if the link is lost.

### Database integrity
All FK columns now have explicit `references()` with documented delete behavior:
- `CASCADE` on project-scoped children: `content_fields`, `domains`, `drafts`, `invites`, `project_keys`, `project_users`, `activity` — deleting a project cleans up everything it owns in one shot.
- `CASCADE` on `sessions.user_id`, `password_reset_tokens.user_id`, `project_users.user_id` — deleting a user purges their auth + memberships.
- `RESTRICT` on `projects.owner_id` and `activity.user_id` — projects must always have an owner; audit history must outlive a user.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema Tables
- `users` — auth users
- `sessions` — bearer token sessions
- `projects` — user-owned projects (now with `lastSeenAt` + `lastSeenOrigin` for install diagnostics)
- `content_fields` — editable content mapped to DOM selectors
- `invites` — client invite emails
- `project_users` — project membership + roles
- `domains` — connected domains per project
- `activity` — audit log entries
- `drafts` — pending content changes from clients
- `content_snapshots` — DOM scan results from the embedded scanner script
- `project_keys` — hashed project API keys (full key shown only at creation as `rawKey`)

## Product-maturity improvements (Apr 2026)
Six shipped together to move the "vibe coder helpfulness" needle:
- **Last-seen diagnostic** — `projects.last_seen_at` is bumped on every authenticated public-content GET/POST and snapshot. `lastSeenOrigin` stores ONLY the URL origin (scheme://host[:port]) — never path or query — to avoid Referer leakage of session ids or PII. `<LastSeenBadge />` renders 4 states on dashboard rows + project header: red "Never seen", green "Live" (≤10 min), neutral "Seen Xh ago" (≤24 h), amber "Last seen Xd ago".
- **Autosave conflict prompt** — editor drafts in localStorage use a v2 envelope `{_v:2, value, capturedServerUpdatedAt}` (parser only accepts the format if the `_v` marker is present, falling back to plain-string for legacy drafts). On hydrate, if the server's `updatedAt` moved past the captured timestamp AND values differ, a per-field amber banner offers Keep mine / Use server.
- **Client onboarding modal** — first editor visit per project per device shows a 2-step modal (welcome + role-aware "what happens when you save"). Gated by `localStorage["get:editor-intro-seen:${projectId}"]`. Re-openable via "?" in the editor header.
- **Dashboard 4-up stats** — `/projects/stats` returns Projects / Live sites / Active clients / Edits (30d). Stats are scoped to projects you OWN (label copy reflects this).
- **Image upload caption** — "Max 10 MB · JPG, PNG, WebP, GIF, SVG" under the upload button in the editor's image field.
- **Stack-tabbed install panel** — replaces single-snippet card with tabs for Vanilla HTML / Vite / Next.js / WordPress, dark snippet box with copy, and a "Verify install" button that polls `lastSeenAt` for ~10 s and reports success or guidance.

## API Routes
All under `/api`:
- `GET /healthz`
- `GET/POST /auth/me`, `/auth/signup`, `/auth/login`, `/auth/logout`
- `POST /auth/forgot-password`, `POST /auth/reset-password`
- `GET /auth/google`, `GET /auth/google/callback` — Google OAuth (sign-in / sign-up)
- `GET/POST /projects`, `GET/PATCH/DELETE /projects/:id`
- `GET /projects/stats`
- `GET/POST /projects/:id/content`, `PATCH/DELETE /projects/:id/content/:fieldId`
- `GET/POST /projects/:id/invites`, `DELETE /projects/:id/invites/:inviteId`
- `GET/POST /projects/:id/domains`, `DELETE /projects/:id/domains/:domainId`
- `GET /projects/:id/users`, `PATCH /projects/:id/users/:userId/role`
- `GET /projects/:id/activity`
- `GET /projects/:id/drafts`, `POST /projects/:id/drafts/:draftId/publish`

## Demo Account
- Email: alex@example.com
- Password: demo1234
