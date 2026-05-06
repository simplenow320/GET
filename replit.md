# get SaaS

## Overview

"get" is a full-stack SaaS platform designed to provide developers with a hosted control plane for safely granting clients visual content editing access to their applications. It aims to empower "vibe coders" building in Replit by enabling seamless content updates without compromising application stability. The project's vision is to streamline content management workflows, enhance collaboration between developers and clients, and open up new market opportunities for user-editable web applications.

## User Preferences

The user prefers simple language and direct answers. For development, the user favors an iterative approach, with clear explanations for each step. The user wants to be asked before any major architectural changes are made or new dependencies are introduced. The user wants the agent to focus on delivering functional features quickly. The user wants to ensure that all branding guidelines are strictly followed, especially regarding logo usage and white-labeling within the authenticated application.

## System Architecture

The project is built as a monorepo using `pnpm workspaces` with Node.js 24 and TypeScript 5.9.

**UI/UX Decisions:**
- The frontend uses React, Vite, Tailwind CSS, and `shadcn/ui` for a modern and consistent design.
- Brand assets are strictly managed through a `<BrandLogo />` component, with specific variants for different contexts (full, compact, mascot only). No programmatic recreation of brand elements is allowed.
- The landing page (`/`) features a hero section with the full brand logo and a tagline, without a top navigation.
- Authentication pages (`/login`, `/signup`) use the compact brand logo.
- The authenticated application (`/app/*`) is white-labeled, devoid of "get" branding, except for a friendly mascot accent in the dashboard's empty state.
- A consistent design system is enforced through shared UI primitives (`src/lib/ui.tsx`) including buttons, cards, page headers, and modals, ensuring reusability and brand consistency.
- The color palette for the landing page is warm cream, dark navy, and yellow accent. The app uses a clean grayscale with navy primary buttons.

**Technical Implementations:**
- **Frontend Frameworks:** React, Vite, Tailwind CSS, shadcn/ui.
- **Backend Framework:** Express 5.
- **Database:** PostgreSQL with Drizzle ORM.
- **Validation:** Zod for schema validation.
- **API Codegen:** Orval generates API hooks and Zod schemas from an OpenAPI specification.
- **Routing:** `wouter` for client-side routing.
- **Authentication:**
    - Session-based auth with `scrypt` password hashing and SHA-256 hashed session tokens.
    - Session tokens are stored in an `httpOnly`, `Secure`, `SameSite=Lax` cookie named `gs` with a 30-day TTL.
    - Google OAuth integrates `HMAC-signed state` and `PKCE S256` for secure sign-in/sign-up.
    - Forgot password functionality is designed to prevent email enumeration by ensuring identical wall-clock latency for all requests.
    - RBAC is enforced server-side using `requireProjectAccess(minRole)` middleware.
- **Security:**
    - **CSRF Defense:** `SameSite=Lax` cookies, an `Origin-header gate` for mutating requests, and explicit CORS allowlisting.
    - **XSS Hardening:** All user-supplied strings are sanitized using `xss({ whiteList: {} })` before persistence. The frontend avoids rendering user-generated HTML.
    - **Token Storage:** All sensitive credentials (sessions, project keys, reset tokens, invite tokens) are stored as SHA-256 hashes.
- **Critical Infrastructure:** Public API routes (`/api/public/*`) are intentionally embeddable with permissive CORS and `Cross-Origin-Resource-Policy: cross-origin`. Sensitive endpoints must not be mounted under this path.
- **Project-key origin allowlist:** `requireProjectKey` enforces the project's `domainsTable` allowlist. If a project has zero domains configured, requests from any origin are accepted (back-compat for fresh installs). If at least one domain is configured and the request carries an Origin/Referer header, the hostname must match exactly OR be a subdomain of an allowed apex (e.g. `app.example.com` matches `example.com`; `www.` is normalized). Server-side requests with no Origin/Referer (SSR, cron, curl) are always allowed. Mismatches return 403 and are logged via `req.log.warn`.
- **Database Integrity:** Foreign key relationships are explicitly defined with `CASCADE` for project-scoped children and user-related auth/memberships, and `RESTRICT` for critical relationships like `projects.owner_id`.

**Feature Specifications:**
- **Public Pages:** Landing page, login, signup.
- **Authenticated App Pages:** Dashboard, projects list, project detail (with tabs for content, clients, domains, drafts, API keys, activity, settings), client invite acceptance, multi-step project setup wizard, and a white-label client-facing content editor.
- **Product Maturity Features (Implemented):**
    - **Last-seen diagnostic:** Tracks project activity for install diagnostics.
    - **Autosave conflict prompt:** Manages concurrent edits in the editor.
    - **Client onboarding modal:** Guides first-time editor users.
    - **Dashboard 4-up stats:** Provides key project metrics.
    - **Image upload caption:** Improves UX for image uploads.
    - **Stack-tabbed install panel:** Offers guided installation for various tech stacks.
    - **Per-project `autoPublish` setting:** Controls whether client edits go live immediately or enter a review queue.

**API Routes:**
The API provides endpoints for health checks, authentication (signup, login, logout, password reset, Google OAuth), project management (create, retrieve, update, delete projects, project stats), content management, invites, domain management, user roles within projects, activity logs, and draft publishing.

## External Dependencies

- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **API Gateway/Hosting:** Replit (platform for development and deployment)
- **Email Service (Implied by Forgot Password):** SendGrid (or similar, for sending password reset emails)
- **OAuth Provider:** Google (for "Sign in with Google" functionality)
- **UI Components:** `shadcn/ui`
- **Utility Libraries:** Zod, Orval, wouter, xss