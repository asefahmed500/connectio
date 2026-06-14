# 00 — Overview

**Status:** Draft
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript (strict) · Prisma · PostgreSQL · Tailwind v4 · shadcn/ui

ClientConnect Portal is a multi-tenant web app where a Super Admin generates unique invite links so clients can register, fill out requirement forms, upload files, and receive feedback from the admin team. Three roles: **Super Admin**, **Team Member**, **Client**.

## Layered architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser                                                          │
│  ──────                                                           │
│  Client Components ('use client')                                 │
│  - Forms wired to Server Actions via useActionState               │
│  - Optimistic UI from route handler fetches (where applicable)   │
└──────────────────────────────────────────────────────────────────┘
                              │ HTTPS (SameSite=Lax cookies)
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Edge / Node runtime (Vercel)                                     │
│  ─────────────────────────────                                    │
│                                                                   │
│  1. proxy.ts            — optimistic auth gate, redirect logic    │
│  2. Server Components   — fetch via DAL, render HTML              │
│  3. Server Actions      — mutations from UI ('use server')        │
│  4. Route Handlers      — uploads, webhooks, public/REST          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Data Access Layer (lib/dal/*) — server-only, React cache()       │
│  ──────────────────────────────────────────────────────────       │
│  - verifySession()  → currentUser + role                          │
│  - requireRole(...) → throws unauthorized()/forbidden()           │
│  - Per-resource getters return DTOs (filtered by viewer)          │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  Prisma Client (lib/db.ts singleton)                              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  PostgreSQL (Neon / Supabase)                                     │
└──────────────────────────────────────────────────────────────────┘

Side channels:
  - S3 / Vercel Blob (file storage)
  - SMTP / Resend (email, fire-and-forget via after())
  - Upstash Redis (rate limiting, prod)
```

## Request flow example: client submits a form

1. Browser POSTs the form. React intercepts and calls the Server Action `submitFormAction` over an encrypted internal channel.
2. `submitFormAction` calls `verifySession()` in the DAL. The DAL reads the `session` cookie, decrypts the JWT via `jose`, and returns `{ userId, role, clientId }` (memoized for the render pass via React `cache()`).
3. The action calls `requireRole('CLIENT')`. If the user isn't a client, `forbidden()` throws → Next renders `app/forbidden.tsx`.
4. The action validates the payload with Zod. On failure, it returns `{ errors }` for `useActionState` to render inline.
5. The action delegates to `lib/dal/submissions.ts → createSubmission()`, which enforces the `@@unique([clientId, formId])` constraint, writes the row, and writes an audit log entry inside a Prisma transaction.
6. After commit, `after(() => sendEmail(...))` queues the notification email — non-blocking.
7. The action calls `revalidatePath('/dashboard/visitor/[slug]')` and returns `{ success: true }`. React updates the UI.

Same flow for reads, minus steps 4–7: a Server Component awaits `getSubmissionDTO(id)` from the DAL, which performs the auth check and returns only the fields the viewer may see.

## Key decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Routing | App Router (`app/`) | Next 16 default; PRD's `pages/` model is stale |
| Auth | Self-implemented JWT in HttpOnly cookie (jose + argon2id) | PRD specifies JWT; self-impl keeps dependencies minimal and matches Next 16 docs |
| Session shape | Stateless access (24h) + refresh (7d) tokens, both in cookies | PRD-specified lifetimes; sliding refresh via `updateSession()` |
| Auth gate | `proxy.ts` (v16 rename of `middleware.ts`) | Optimistic checks only; real checks live in the DAL |
| Multi-tenancy | Shared schema, `clientId` FK on every tenant-scoped table | Simpler than schema-per-tenant at this scale; isolation enforced in DAL |
| Password hashing | argon2id (OWASP-recommended) | Superior to bcrypt for modern hardware |
| Data access | DAL with `server-only` + React `cache()` | Canonical Next.js pattern; centralizes authz; prevents client leakage |
| Mutations | Server Actions for UI; Route Handlers for uploads/webhooks | Next 16 data-patterns skill recommendation |
| Validation | Zod at every boundary | Single source of truth; types fall out for free |
| Audit | Append-only `AuditLog` table, written via `after()` | Non-blocking, durable, queryable |
| Rate limiting | In-memory (dev) / Upstash Redis (prod) | Token-bucket per IP + per user |
| File storage | Local FS (dev) / S3-compatible (prod), behind `StorageAdapter` interface | Allows Vercel Blob, R2, or S3 without code changes |
| Email | Nodemailer (dev/prod SMTP) behind `EmailAdapter` | Pluggable for Resend/SES later |

## What's in scope vs deferred

**In scope (this design):**
- All Phase 1 and Phase 2 items from `prd.md`: auth, RBAC, invites, forms, submissions, comments, uploads, email, basic analytics, audit log.
- Production-readiness: security review, observability, deployment, migration strategy.

**Explicitly deferred (Phase 3+):**
- Realtime / WebSocket (will require separate transport; Server Actions are synchronous)
- Mobile app (React Native; separate repo)
- AI form suggestions
- Slack/Zapier integrations
- SSO / OAuth providers (design allows adding later without rework)

## Divergences from `prd.md`

These are deliberate. Where `prd.md` and these docs disagree, these docs win.

| `prd.md` says | We do instead | Reason |
|---------------|---------------|--------|
| `pages/` directory | `app/` directory (App Router) | Next 16 default; `pages/` is the legacy router |
| `pages/api/*` route handlers | `app/**/route.ts` (Route Handlers) + Server Actions | App Router conventions |
| `middleware/auth.ts` custom wrapper | `proxy.ts` + DAL | `middleware` was renamed to `proxy` in v16; Next 16 docs recommend DAL over custom wrappers |
| `jsonwebtoken` + `bcrypt` | `jose` + `argon2` | `jose` is Edge+Node compatible (the Next 16 docs' choice); argon2id is OWASP's current recommendation |
| Session in single `Authorization` cookie | `access_token` + `refresh_token` cookies | Allows short-lived access + revocation via refresh-token invalidation |
| `getServerSideProps` auth | Server Component + `verifySession()` | Idiomatic App Router |

## Non-goals

- Building a generic SaaS multi-tenancy framework. Tenants here are clients, not organizations-with-their-own-users.
- Supporting public sign-up. Only invite-based registration is allowed.
- Backwards compatibility with the Pages Router.
- Self-hosting on bare metal. Vercel is the primary target; Docker is documented but secondary.
