# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

| What | Command |
|------|---------|
| Dev server | `npm run dev` (http://localhost:3000) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) |
| Lint | `npm run lint` (ESLint flat config) |
| Build | `npm run build` |
| Run all tests | `npm test` (vitest) |
| Watch tests | `npm run test:watch` |
| **Single vitest file** | `npx vitest run tests/unit/tokens.test.ts` |
| **Single vitest test by name** | `npx vitest run -t "rejects expired tokens"` |
| E2E tests | `npm run test:e2e` (Playwright) |
| **Single Playwright spec** | `npx playwright test tests/e2e/auth-flow.spec.ts` |
| Audit (typecheck + lint + test) | `npm run audit` |
| DB migrate (dev) | `npm run db:migrate:dev` |
| DB studio | `npm run db:studio` |
| DB seed | `npm run db:seed` |

**Verify order before considering work done:** `typecheck → build`. Lint + tests run in parallel; `npm run audit` runs all three.

## Project status — implemented

ClientConnect Portal is a multi-tenant client portal with three roles (Super Admin, Team Member, Client), JWT + refresh-token auth, dynamic requirement forms with a submission state machine, file uploads (local + S3), 2-level threaded comments, notifications (SSE + email), and an admin analytics dashboard. The scaffold in the original `prd.md` is largely built.

- **Source of truth for behavior & architecture:** `AGENTS.md` (imported above) + the doc files under `docs/`. Read the relevant `docs/NN-*.md` before modifying a subsystem.
- **`prd.md` is a historical spec.** It describes `pages/api/*` route handlers and `lib/prisma.ts`, but the actual project uses the **App Router** (`app/.../route.ts`) and `lib/db.ts`. When `prd.md` conflicts with code or AGENTS.md, trust the code.
- **Performance work in flight:** `PERFORMANCE_AUDIT.md` + `PERFORMANCE_PLAN.md` at repo root.

## Tech stack

- **Next.js 16.2.9, React 19.2.4** — App Router. `middleware.ts` is renamed to **`proxy.ts`**; do not create `middleware.ts`. Per `AGENTS.md`, consult `node_modules/next/dist/docs/` before writing Next.js code — APIs from training data may have moved.
- **Prisma 6 + PostgreSQL** — schema at `prisma/schema.prisma`. Singleton at `lib/db.ts` (global-cached for dev hot-reload). Every DB call must go through `lib/dal/*`; never call `prisma` directly from a page/action.
- **Auth:** `jose` (JWT, HS256) + `@node-rs/argon2` (argon2id passwords). Dual-token system (access + refresh) with `User.tokenVersion` for session invalidation.
- **Tailwind CSS v4** — CSS-first config via `@import "tailwindcss"` + `@theme inline {}`. No `tailwind.config.ts`. Theme tokens are oklch CSS variables in `app/globals.css`.
- **shadcn/ui v4 (Radix Nova)** — `components.json` style `"radix-nova"`, 47 components in `components/ui/`, icon library `lucide-react`.
- **Zod 4** — note `.email()` returns a string, not `z.ZodString`.
- **TypeScript strict, `@/*` → project root** (no `src/`). `server-only` must be the first import in every `lib/` module.

## Architectural pillars (details in AGENTS.md)

1. **DAL (`lib/dal/*`)** is the only door to the database. Pattern: auth check → RBAC (`requireClientAccess`) → return plain DTO (cached for reads) → mutate in `$transaction` with `writeAudit()` → `notify()` for real-time. Soft deletes via `deletedAt` on Client, Form, Submission, File, Comment, TeamMember.
2. **3-role RBAC** with one route group per role: `(admin)`, `(team)`, `(client)`, plus `(auth)`. Layouts enforce via `requireRole()`.
3. **Submission state machine** (`DRAFT → SUBMITTED → IN_REVIEW → APPROVED | CHANGES_REQUESTED → SUBMITTED | REJECTED`) gated by `canTransition()` in `lib/dal/submissions.ts`. `@@unique([clientId, formId])` enforces one submission per client per form.
4. **Notifications** — 17 event types. Adding a new event requires touching 4 files (see AGENTS.md §Notifications). SSE at `/api/notifications/stream` with polling fallback.
5. **Storage adapter** (`lib/storage/`) — `LocalFsAdapter` in dev, `S3Adapter` auto-wires in prod when `S3_*` env vars are set. Magic-byte validation before write. Deletes are soft on the DB row; storage objects are kept.

## Available agent skills

Skills vendored under `.agents/skills/` (registered in `skills-lock.json`) cover Next.js 16 specifics (`next-best-practices`, `next-cache-components`, `next-upgrade`, `next-browser`), shadcn, and Vercel deploy/perf/composition patterns. Prefer these over guessing Next 16 / shadcn behavior.
