# ClientConnect — Agent Instructions

## Commands

| What | Command |
|------|---------|
| Dev server | `npm run dev` (port 3000) |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` |
| Lint | `npm run lint` (~30s cold start) |
| Tests | `npm test` (vitest, sequential, needs Postgres) |
| Single test | `npx vitest run tests/unit/tokens.test.ts` |
| Single test by name | `npx vitest run -t "test name"` |
| E2E | `npm run test:e2e` (playwright, port 3001) |
| Audit | `npm run audit` (typecheck → lint → test) |
| DB migrate dev | `npm run db:migrate:dev` |
| DB seed | `npm run db:seed` (`tsx prisma/seed.ts`) |
| Seed test data | `npx tsx scripts/seed-test-data.ts` |

**Verify order:** `typecheck → build`. CI would run `typecheck → lint → test` (no GitHub workflows present currently).

## Stack

- **Next.js 16** — middleware file is `proxy.ts` (same API as `middleware.ts`). No `src/` dir. `@/*` → `./*`.
- **shadcn/ui v4 Radix Nova** — 45 components installed (`components/ui/`). Use `npx shadcn@latest docs <component>` for API docs.
- **Tailwind CSS 4** — `@import "tailwindcss"` in CSS, `@theme inline {}` block, no `tailwind.config.ts`.
- **Prisma + Postgres** — singleton at `lib/db.ts` (global-cached for dev hot-reload).
- **React 19** — `useActionState` (not `useFormState`). `z.email()` returns `string`, not `ZodString`.
- **Zod 4** — `.refine()` on email requires domain contains `.` (rejects `@localhost`).
- **`server-only`** — first import in every `lib/` module. Vitest stubs via `resolve.alias` → `tests/stubs/empty.ts`.
- **Lucide icons** + **`data-icon`** prop on icons inside Button. `data-icon="inline-start"` or `"inline-end"`.

## Auth Architecture

Dual-token: JWT access (24h, `access_token` cookie) + opaque refresh (7d, SHA-256 in `Session`, `refresh_token` cookie).
`User.tokenVersion` in JWT as `ver` — `getCurrentUser()` rejects stale versions on every DB call.
Token refresh: `POST /api/auth/refresh` — CSRF-protected, rate-limited 60/min per IP, rotated in a transaction.

**Boot env validation** in `instrumentation.ts` — throws on bad config before first request.

### proxy.ts — 3 Optimistic Guards (JWT-only, no DB)

| Guard | Action |
|-------|--------|
| Unauthenticated → protected | Redirects to `/login?next=<path>` |
| Authenticated → auth pages | Redirects to role dashboard |
| Cross-role mismatch | Redirects to correct dashboard |

**Critical gotcha:** `forbidden()` and `unauthorized()` are **experimental** and require `experimental.authInterrupts` in next.config (NOT enabled). Code uses `const forbidden = notFound` shim in `lib/dal/session.ts`. Replace `unauthorized()` with `redirect('/login')`.

## Data Access Layer

**Every Prisma call** MUST go through `lib/dal/*`. Never call `prisma` from pages or actions.

Pattern: `getCurrentUser()` / `requireSession()` → `requireRole()` / `requireClientAccess()` → plain DTOs (no Prisma objects). Reads wrapped in `cache()`. Mutations call `writeAudit()` + `notify()`. Soft deletes via `deletedAt: null` filter on all queries.

**Pagination:** `lib/dal/pagination.ts` — `PaginatedResult<T>`, `paginationParams()`, `toPaginated()`. Preserve `&pageSize=` in pagination links.

**Non-null assertions needed** inside `$transaction` callbacks (`user!`, `claims!`) — TS loses narrowing across the callback boundary.

## Layout & Navigation

- Route groups: `(admin)`, `(team)`, `(client)`, `(auth)`. Layouts call `requireRole()` authoritatively.
- Sidebar starts **collapsed** (`defaultOpen={false}`) to maximize content width. Toggle via hamburger in header.
- Notification bell in **top-right of main header** (not sidebar) for all 3 roles.
- `/invite/[slug]` is intentionally public — no proxy protection.

## shadcn/ui — Critical Rules

Forms use `FieldGroup` + `Field` + `FieldLabel`. Validation: `data-invalid` on `Field`, `aria-invalid` on control.
Use `flex flex-col gap-*` — never `space-y-*`. Use `Card`/`CardContent`/`CardHeader` — never `border rounded-lg`.
Use `Badge` for labels/pills. Use `Separator` for dividers. Use `cn()` for conditional classes. No `dark:` color overrides — use semantic tokens (`bg-primary`, `text-muted-foreground`).

## Brand (Applied)

| Token | Value |
|-------|-------|
| Body font | **Manrope** (`--font-manrope`) |
| Heading font | **Noto Serif** (`--font-heading`, CSS: `h1-h6 @apply font-heading`) |
| Palette | Warm sand/ochre (Sun-Baked Simplicity). Primary: golden ochre `oklch(0.48 0.08 75)`. Background: warm off-white. |
| Personality | **Clear. Reliable. Respectful.** Restrained color strategy. |

## Notification System

14 event types in `lib/notifications/types.ts`. Adding a new event requires updating 4 files:
1. `NotificationType` enum in `prisma/schema.prisma`
2. Discriminated union in `lib/notifications/types.ts`
3. `computeRecipients()` in `lib/notifications/audience.ts`
4. `renderTemplate()` in `lib/notifications/templates.ts`

Transport: SSE at `/api/notifications/stream` with polling fallback. Upstash Redis for pub/sub when configured.

## Key Gotchas

- **`audit` is slow** (lint ~30s). Use `typecheck` for quick iteration.
- **Integration tests need Postgres** (`connectio_test` DB). Vitest runs **sequentially** (`fileParallelism: false`). Run `npx prisma migrate deploy` first.
- **Form schema JSON** stored as `Json` in Prisma; parsed via `FormSchemaV1.safeParse()`. Adding field type = update `schema.ts` + `validate.ts`.
- **Storage adapters** auto-wired by env vars: R2 → `S3Adapter`, S3 → `S3Adapter`, else `LocalFsAdapter(root = ./storage)` in dev. Production requires R2 or S3 config.
- **SSE streaming** — needs Upstash Redis for pub/sub; falls back to polling in dev.
- **`req` param** unused in route handlers — keep it in the signature (Next.js passes it).
- **Auth forms** use `<form onSubmit={onSubmit} noValidate>` with `useCallback` + `FormData` — NOT `action={action}` directly (causes dual validation errors).
