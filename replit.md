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
- `/app/projects/:projectId` — Project detail with tabs: Content Map, Clients, Domains, Drafts, Activity, Settings
- `/app/setup/:projectId` — Multi-step setup wizard
- `/app/editor/:projectId` — Client-facing content editor (white-label, no branding)

## Brand
- **Logo/mascot**: attached_assets/IMG_6687_1777091776547.jpeg (hero) + B56BFD2D...png (mascot)
- **Tagline**: "Let clients edit your app without breaking it."
- **Landing palette**: Warm cream (#faf9f6), dark navy (#1a1a2e), yellow accent (#FFD747)
- **App palette**: White-label, clean grayscale, no get branding inside the app

## Auth
Session-based auth using SHA-256 password hashing + random bearer tokens stored in `sessions` table. Pass `Authorization: Bearer <token>` header on all authenticated API calls. Token is stored in localStorage.

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
