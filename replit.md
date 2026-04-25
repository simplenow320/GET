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

## Brand rules (strict)
- **The ONLY "get" mark** is the uploaded asset `attached_assets/IMG_6687_1777091776547.jpeg`. Render it via `<BrandLogo />` from `src/lib/ui.tsx`. NEVER recreate the wordmark or mascot programmatically (no fake `<Wordmark>` text component, no SVG copies).
- **Landing page**: hero uses BrandLogo, no top nav, no header links, no tiny corner logo, no secondary brand marks, no footer brand mark. Tagline lives baked into the asset and is mirrored as an sr-only H1: "Let clients edit your app without breaking it." (no em-dash).
- **Auth pages (/login, /signup) and /not-found**: small BrandLogo (≤140px) is OK — these are landing-adjacent.
- **Authenticated product UI (/app/\*)**: WHITE-LABEL. No BrandLogo, no get-branded copy, no mascot anywhere. Sidebar header shows uppercase "Workspace". Setup top bar shows "Set up project". Editor top bar shows "Editor". Each affected file has a comment marker enforcing this.
- `GET_PROJECT_KEY` env var name is allowed in code snippets — it's the developer-facing API contract identifier (like `STRIPE_SECRET_KEY`), not branding.
- **Landing palette**: Warm cream (#faf9f6), dark navy (#1a1a2e), yellow accent (#FFD747)
- **App palette**: White-label, clean grayscale, navy primary buttons

## Shared UI primitives (`src/lib/ui.tsx`)
All pages import design tokens (`BRAND`, `tone`, `line`, `type`, `r`, `ease`, `status`) and components (`PrimaryButton`, `SecondaryButton`, `GhostButton`, `DangerButton`, `Card`, `PageHeader`, `SectionTitle`, `EmptyState`, `Pill`, `Field`, `BrandLogo`, `PageContainer`, `ConfirmDialog`) from this module. When adding new pages, reuse these instead of inventing one-off styles. `Field` auto-generates an `id` for its child input and wires `htmlFor` on the label. `ConfirmDialog` wraps Radix AlertDialog with brand styling — use it for ALL destructive confirmations (delete, revoke, etc.). Never use native `confirm()` / `alert()`.

## Auth
Session-based auth using scrypt password hashing + random session tokens (SHA-256 hashed at rest in the `sessions` table). The session token is set as an **httpOnly, Secure, SameSite=Lax cookie** named `gs` (30-day TTL). The frontend never reads or stores the raw token — `lib/api-client-react/src/custom-fetch.ts` sets `credentials: "include"` so the browser attaches it automatically. Bearer-token auth is still accepted for non-browser/CLI clients. RBAC is enforced backend-side via `requireProjectAccess(minRole)` middleware.

### CSRF defense (defense in depth)
1. **SameSite=Lax** on the session cookie blocks most cross-site form/fetch CSRF.
2. **Origin-header gate** in `app.ts` runs on every mutating request (POST/PUT/PATCH/DELETE outside `/api/public/*`). It hardens against the case where Replit's edge proxy rewrites `SameSite=Lax` to `None` for iframe contexts. Rules: allowlisted Origin → pass; missing Origin + no session cookie → pass (curl/Bearer client); everything else → 403 "Bad origin".
3. **CORS allowlist** is explicit (REPLIT_DEV_DOMAIN, APP_BASE_URL, localhost) — never wildcards on shared hosting domains. Disallowed origins receive no `Access-Control-Allow-Origin` (soft reject via `cb(null, false)`), so browsers cannot read responses.
4. **XSS hardening**: every user-supplied string is run through `xss({ whiteList: {} })` in `lib/sanitize.ts` before persistence; the frontend renders no user-generated HTML and uses no `dangerouslySetInnerHTML`.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## DB Schema Tables
- `users` — auth users
- `sessions` — bearer token sessions
- `projects` — user-owned projects
- `content_fields` — editable content mapped to DOM selectors
- `invites` — client invite emails
- `project_users` — project membership + roles
- `domains` — connected domains per project
- `activity` — audit log entries
- `drafts` — pending content changes from clients

## API Routes
All under `/api`:
- `GET /healthz`
- `GET/POST /auth/me`, `/auth/signup`, `/auth/login`, `/auth/logout`
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
