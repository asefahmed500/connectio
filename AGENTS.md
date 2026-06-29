# ClientConnect — Agent Instructions

## Commands

| What | Command |
|------|---------|
| Dev server | `npm run dev` (port 3000) |
| Typecheck | `npm run typecheck` (fast) |
| Build | `npm run build` (slow, use for final verify) |
| Lint | `npm run lint` (~30s cold start) |
| All tests | `npm test` (vitest, sequential, needs Postgres) |
| Single test file | `npx vitest run tests/unit/pagination.test.ts` |
| Single test by name | `npx vitest run -t "rejects expired tokens"` |
| E2E | `npm run test:e2e` (Playwright, port 3001) |
| Audit | `npm run audit` (typecheck -> lint -> test) |
| DB migrate dev | `npm run db:migrate:dev -- --name <verb>_<entity>` |
| DB migrate deploy | `npm run db:migrate` |
| DB seed | `npm run db:seed` |
| DB studio | `npm run db:studio` |

**CI** (`.github/workflows/ci.yml`): `typecheck -> lint -> test`, not `build`.  
**Verify before commit:** `typecheck -> build`. Lint + tests can run in parallel.

## Stack

- **Next.js 16** — middleware file is `proxy.ts` (not `middleware.ts`). No `src/` dir. `@/*` -> `./*`.
- **shadcn/ui v4 Radix Nova** — `components.json` style `"radix-nova"`, 45 components in `components/ui/`. Icons use `data-icon="inline-start"` / `data-icon="inline-end"` (CSS target, not prop).
- **Tailwind CSS 4** — `@import "tailwindcss"` in CSS, `@theme inline {}` block in `app/globals.css`, no `tailwind.config.ts`. Theme tokens are oklch CSS variables.
- **Prisma 6 + Postgres** — singleton at `lib/db.ts` (global-cached for dev). 2 migrations committed. Run `prisma migrate deploy` on fresh DB.
- **React 19** — `useActionState` (not `useFormState`). `server-only` first import in every `lib/` module. Stubbed in tests via `resolve.alias` -> `tests/stubs/empty.ts`.
- **Zod 4** — `.email()` returns `string`, not `ZodString`. `.refine()` on email requires domain contains `.`.
- **ESLint 9** flat config at `eslint.config.mjs` — `eslint-config-next/core-web-vitals` + `typescript`.

## Architecture

```
proxy.ts -> Server Components -> DAL (lib/dal/*) -> Prisma
                                Server Actions -> DAL -> writeAudit() + notify()
                                Route Handlers -> DAL -> storage adapter
```

**DAL is the only door to the database.** Never call `prisma` from pages or actions. Pattern: `getCurrentUser()` / `requireSession()` -> `requireRole()` / `requireClientAccess()` -> plain DTOs. Reads wrapped in `cache()`. Mutations wrapped in `$transaction` with `writeAudit()` + `notify()` outside tx.

Soft deletes via `deletedAt: null` filter on Client, TeamMember, Form, Submission, File, Comment. **AuditLog has no `deletedAt`** (append-only).

**Docs** at `docs/` (20 files, `docs/README.md` has reading order). Code is source of truth; docs may be aspirational. `prd.md` is legacy — describes `pages/api/*` and `lib/prisma.ts` that don't exist.

## Auth

Dual-token: JWT access (24h, `access_token` cookie) + opaque refresh (7d, SHA-256 in `Session`, `refresh_token` cookie). `User.tokenVersion` in JWT as `ver` — `getCurrentUser()` rejects stale versions on every DB call.

Refresh: `POST /api/auth/refresh` — CSRF-protected (Origin check), rate-limited 60/min per IP, rotated in a `$transaction`. Boot env validation in `instrumentation.ts`.

### proxy.ts — Optimistic Guards (JWT-only, no DB)

| Guard | Action |
|-------|--------|
| Unauthenticated -> protected | Redirects to `/login?next=<path>` |
| Authenticated -> auth pages | Redirects to role dashboard |
| Cross-role mismatch | Redirects to correct dashboard |

**Gotcha:** `forbidden()` needs `experimental.authInterrupts` (NOT enabled). Code uses `const forbidden = notFound` in `lib/dal/session.ts`.

## Route Groups & Layout

- Route groups: `(admin)`, `(team)`, `(client)`, `(auth)`. Layouts enforce via `requireRole()`.
- Sidebar starts **collapsed** (`defaultOpen={false}`). Toggle via hamburger in header.
- Notification bell in **header top-right** for all 3 roles via `NotificationsBell` component.
- `/invite/[slug]` is intentionally public — no proxy protection.

## shadcn/ui & Styling

- Forms use `FieldGroup` + `Field` + `FieldLabel` from `components/ui/field.tsx`.
- Validation: `data-invalid` on `Field`, `aria-invalid` on control.
- Use `flex flex-col gap-*` — never `space-y-*`.
- Use `Card`/`CardContent`/`CardHeader` — never `border rounded-lg`.
- Use `cn()` from `lib/utils.ts` for conditional classes.
- No `dark:` overrides — use semantic CSS variables.
- Icons: `lucide-react`.

### Brand (in `app/globals.css`)

- **Body font:** Manrope (`--font-manrope`). **Heading:** Noto Serif (`--font-heading`, `h1-h6 @apply font-heading`).
- **Palette:** Warm sand/ochre. Primary: golden ochre `oklch(0.48 0.08 75)`. Background: warm off-white.
- **Radius:** `--radius: 0.375rem`. Computed tokens via `calc()`.

## Notifications

13 event types in `lib/notifications/types.ts` (17 in Prisma `NotificationType` enum). Adding a new event requires updating 4 files:
1. `NotificationType` enum in `prisma/schema.prisma`
2. Discriminated union in `lib/notifications/types.ts`
3. `computeRecipients()` in `lib/notifications/audience.ts`
4. `renderTemplate()` in `lib/notifications/templates.ts`

Transport: SSE at `/api/notifications/stream` (`GET`). Polls DB every 8s with per-connection cursor. Falls back to polling in dev. Needs Upstash Redis for pub/sub at scale.

## Format & Storage

- **Forms:** `FormSchemaV1` (Zod) stored as Prisma `Json`. Parsed via `FormSchemaV1.safeParse()`. Adding a field type -> update `lib/forms/schema.ts` + `lib/forms/validate.ts` + client-side `FieldRenderer`.
- **Files:** Storage adapter auto-wired: `S3Adapter` when `S3_*` or `R2_*` env vars present, else `LocalFsAdapter(root=./storage)` in dev. Production throws without S3/R2 config. Magic-byte validation before write. Deletes are soft on DB row; storage objects kept.
- **Rate limiter:** Hybrid — Upstash Redis when configured, in-memory token bucket fallback. Public API: `rateLimit(key, bucket)` and `rateLimitAll(...checks)`.
- **Email:** Nodemailer SMTP. Stubs to console in dev if unconfigured. Silent drop in production.

## Testing

- **Needs Postgres** (`connectio_test` DB). Vitest runs sequentially (`fileParallelism: false`).
- Integration tests (under `tests/integration/`) truncate all tables between tests.
- E2E tests (under `tests/e2e/`) use Playwright on port 3001, sequential, 1 worker.
- `tests/stubs/empty.ts` mocks `server-only` in vitest config.
- `tests/setup.ts` mocks `next/headers` globally — sets `AUTH_JWT_SECRET`, `DATABASE_URL`. Tests swap user via `globalThis.__ccTestToken`.

## Key Gotchas

- **`typecheck` is fast, `build` is the real verification.** CI runs `typecheck -> lint -> test`, not `build`.
- **Route handler `req` param** — keep in signature even if unused (Next.js passes it).
- **Auth forms** use `<form action={action} noValidate>` with hidden inputs. Server action validates; `react-hook-form` provides `register()` for UI.
- **Scripts** in `scripts/`: `seed-test-data.ts`, `reset-admin.ts`, `ensure-e2e-admin.ts`, `smoke-auth.ts`, `count.ts`.
- **`server-only`** must be first import in every `lib/` module (not enforced by tooling but by convention).
- **`AuditLog` is append-only** — no `deletedAt`, no update, no cascade delete.
- **Pagination:** `lib/dal/pagination.ts` — `DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=100`, helper `paginationParams()` for Prisma `take`/`skip`.
- **`.env.example`** is the authoritative env var catalog. `DATABASE_URL`, `AUTH_JWT_SECRET` required; `AUTH_PASSWORD_PEPPER` optional.
