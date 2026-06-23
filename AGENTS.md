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

**Verify order:** `typecheck → build`. CI would run `typecheck → lint → test`.

## Stack

- **Next.js 16** — middleware file is `proxy.ts` (same API as `middleware.ts`). No `src/` dir. `@/*` → `./*`.
- **shadcn/ui v4 Radix Nova** — 45 components in `components/ui/`. Use `npx shadcn@latest docs <component>` for API docs.
- **Tailwind CSS 4** — `@import "tailwindcss"` in CSS, `@theme inline {}` block, no `tailwind.config.ts`.
- **Prisma + Postgres** — singleton at `lib/db.ts` (global-cached for dev hot-reload).
- **React 19** — `useActionState` (not `useFormState`). `server-only` first import in every `lib/` module.
- **Zod 4** — `.email()` returns `string`, not `ZodString`. `.refine()` on email requires domain contains `.`.
- **Lucide icons** — use `data-icon="inline-start"` / `data-icon="inline-end"` prop on icons inside Button.

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

**Gotcha:** `forbidden()` requires `experimental.authInterrupts` (NOT enabled). Code uses `const forbidden = notFound` shim in `lib/dal/session.ts`. `unauthorized()` is not called in app code (only in docs/).

## Data Access Layer

**Every Prisma call** MUST go through `lib/dal/*`. Never call `prisma` from pages or actions.

Pattern: `getCurrentUser()` / `requireSession()` → `requireRole()` / `requireClientAccess()` → plain DTOs (no Prisma objects). Reads wrapped in `cache()`. Mutations call `writeAudit()` + `notify()`. Soft deletes via `deletedAt: null` filter on all queries.

**Pagination:** `lib/dal/pagination.ts` — `PaginatedResult<T>`, `paginationParams()`, `toPaginated()`. Preserve `&pageSize=` in pagination links.

**Non-null assertions needed** inside `$transaction` callbacks (`user!`, `claims!`) — TS loses narrowing across the callback boundary.

## Layout & Navigation

- Route groups: `(admin)`, `(team)`, `(client)`, `(auth)`. Layouts call `requireRole()` authoritatively.
- Sidebar starts **collapsed** (`defaultOpen={false}`). Toggle via hamburger in header.
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
| Heading font | **Noto Serif** (`--font-heading`, `h1-h6 @apply font-heading`) |
| Palette | Warm sand/ochre (Sun-Baked Simplicity). Primary: golden ochre `oklch(0.48 0.08 75)`. Background: warm off-white. |

## Notification System

14 event types in `lib/notifications/types.ts`. Adding a new event requires updating 4 files:
1. `NotificationType` enum in `prisma/schema.prisma`
2. Discriminated union in `lib/notifications/types.ts`
3. `computeRecipients()` in `lib/notifications/audience.ts`
4. `renderTemplate()` in `lib/notifications/templates.ts`

Transport: SSE at `/api/notifications/stream` with polling fallback. Upstash Redis for pub/sub when configured.

## Key Gotchas

- **`audit` is slow** (lint ~30s). Use `typecheck` for quick iteration.
- **Integration tests need Postgres** (`connectio_test` DB). Vitest runs **sequentially** (`fileParallelism: false`). Run `npx prisma migrate deploy` first. `server-only` is stubbed via `resolve.alias` → `tests/stubs/empty.ts`.
- **Form schema JSON** stored as `Json` in Prisma; parsed via `FormSchemaV1.safeParse()`. Adding field type = update `schema.ts` + `validate.ts`.
- **Storage adapters** auto-wired by env vars: R2 → `S3Adapter`, S3 → `S3Adapter`, else `LocalFsAdapter(root = ./storage)` in dev. Production requires R2 or S3 config.
- **SSE streaming** — needs Upstash Redis for pub/sub; falls back to polling in dev.
- **Auth forms** use `<form action={action} noValidate>` with hidden inputs for extra params. Server action handles validation; react-hook-form provides UI feedback via `register()`.
- **Route handler `req` param** — keep it in the signature even if unused (Next.js passes it).
