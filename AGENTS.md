# ClientConnect — Agent Instructions

## Commands

| What | Command |
|------|---------|
| Dev server | `npm run dev` (port 3000) |
| Typecheck | `npm run typecheck` |
| Lint | `npm run lint` (eslint, ~30s on cold start) |
| Tests | `npm test` (vitest, 69 tests) |
| Build | `npm run build` |
| E2E | `npm run test:e2e` (playwright, port 3001, sequential) |
| Audit all | `npm run audit` (typecheck → lint → test) |
| DB migrate dev | `npm run db:migrate:dev` |
| DB seed | `npm run db:seed` (`tsx prisma/seed.ts`) |
| Seed test data | `npx tsx scripts/seed-test-data.ts` |

**Verify order:** `typecheck → build`. Audit runs sequentially: typecheck → lint → test. Lint is slow (~30s); use a longer timeout if running via agent.

## Stack Quirks

- **Next.js 16** — middleware file is `proxy.ts` (not `middleware.ts`). Same API.
- **No `src/`** — everything at root: `app/`, `lib/`, `components/`, `hooks/`.
- **`@/*` → `./*`** — alias maps to project root.
- **Tailwind CSS 4** — `@import "tailwindcss"` + `@theme inline {}` in CSS. No `tailwind.config.ts`.
- **shadcn/ui v4 Radix Nova** — `components.json` style `"radix-nova"`. 47 components in `components/ui/`.
- **React 19 + Zod 4** — `useActionState` (not `useFormState`). `z.email()` returns `string`, not `ZodString`.
- **`server-only`** — first import in every `lib/` module. Vitest stubs it via `tests/stubs/empty.ts` in config.
- **`prisma`** — singleton at `lib/db.ts`, global-cached for dev hot-reload.

## Auth Architecture

Dual-token: JWT access (24h, `access_token` cookie) + opaque refresh (7d, SHA-256 hashed in `Session`, `refresh_token` cookie).
`User.tokenVersion` in JWT as `ver` — `getCurrentUser()` rejects stale versions on every DB call.
Token refresh: `POST /api/auth/refresh` — CSRF-protected (origin check), rate-limited (60/min per IP), rotates in a transaction.

### proxy.ts (Middleware) — 3 Optimistic Guards

| Guard | What it does |
|-------|-------------|
| Unauthenticated → protected | Redirects to `/login?next=<path>` |
| Authenticated → auth pages | Redirects to role dashboard (`/admin`, `/team`, `/dashboard/visitor/[slug]`) |
| Cross-role | CLIENT→/admin|team → /dashboard/visitor, TEAM_MEMBER→/admin → /team, SUPER_ADMIN→/team|dashboard → /admin |

**Critical:** proxy is optimistic JWT-only (no DB). Real auth enforced in `lib/dal/session.ts`. Don't add DB work here — runs on every request including prefetches.

## Data Access Layer

**Every Prisma call** MUST go through `lib/dal/*`. Never call `prisma` from pages or actions.

Pattern:
1. Auth: `getCurrentUser()` / `requireSession()` / `requireRole()`
2. RBAC: `requireClientAccess(clientId)` — SUPER_ADMIN always, CLIENT own, TEAM_MEMBER via `TeamAssignment`
3. Returns **plain DTOs** (no Prisma objects) — serializable over RSC
4. Read-only DTOs wrapped in `cache()` (React `cache`)
5. Mutations call `writeAudit(params, tx?)` — pass `tx` from `$transaction` for atomic audit
6. Mutations trigger `notify()` for real-time events

**Soft deletes:** Client, Form, Submission, File, Comment, TeamMember have `deletedAt DateTime?`. All reads filter `deletedAt: null`. Delete ops set `deletedAt`. The raw SQL in `getTopClientsByActivity()` also filters soft-deletes via `AND s."deletedAt" IS NULL`.

**Pagination:** `lib/dal/pagination.ts` — `PaginatedResult<T>`, `paginationParams()`, `toPaginated()`. All list pages preserve `&pageSize=` in pagination links.

## RBAC — 3 Roles

| Role | Route prefix | Layout auth |
|------|-------------|-------------|
| `SUPER_ADMIN` | `/admin/*` | `requireRole('SUPER_ADMIN')` |
| `TEAM_MEMBER` | `/team/*` | `requireRole('TEAM_MEMBER')` |
| `CLIENT` | `/dashboard/visitor/[slug]/*` | `requireRole('CLIENT')` + `requireClientAccessBySlug(slug)` per page |

Route groups: `(admin)`, `(team)`, `(client)`, `(auth)`. Layouts call `requireRole()` authoritatively.
`/invite/[slug]` is intentionally public — no proxy protection, no layout auth.

## Server Actions — Form Pattern

All auth forms (login, forgot-password, reset-password) use:
```tsx
<form onSubmit={onSubmit} noValidate>
```
With `useCallback` wrapper that reads `FormData` manually. The `noValidate` prevents HTML5 validation from firing before react-hook-form's Zod validation. Using `action={action}` directly causes dual validation errors.

`useActionState` + `bind()` for parameterized actions:
```tsx
const [state, action, pending] = useActionState(resetPasswordAction.bind(null, token), undefined)
```

## Key Gotchas

- **`audit` command is slow** — lint takes ~30s. Use separate `typecheck` + `test` for quick iteration.
- **`req` param unused in route handlers** — Next.js passes it but some handlers don't use it (e.g. `api/auth/refresh/route.ts`). Keep the param in the signature.
- **`startTransition` for carousel init** — `components/ui/carousel.tsx` uses `React.startTransition()` to wrap `onSelect(api)` init call, avoiding React 19's `set-state-in-effect` lint rule.
- **Form schema JSON** — stored as `Json` in Prisma; parsed via `FormSchemaV1.safeParse()` in `lib/forms/schema.ts`. Adding a field type = update `schema.ts` + `validate.ts` + `field-renderer.tsx`.
- **Storage adapters** — auto-wired by env vars: R2 vars → `S3Adapter` (Cloudflare), S3 vars → `S3Adapter` (generic), else `LocalFsAdapter(root = ./storage)` in dev. Production throws if neither configured.

## Testing

| Suite | Runner | Files |
|-------|--------|-------|
| Unit | Vitest | 4 files, 41 tests (`tests/unit/`) |
| Integration | Vitest | 3 files, 28 tests (`tests/integration/`) |
| E2E | Playwright | 2 specs (`tests/e2e/`, port 3001, sequential) |

Vitest mocks `server-only` via `resolve.alias` → `tests/stubs/empty.ts`. Setup at `tests/setup.ts` sets default `AUTH_JWT_SECRET` + `DATABASE_URL`.

## DAL File Map

| File | Purpose |
|------|---------|
| `lib/dal/session.ts` | Auth — `getCurrentUser`, `requireSession`, `requireRole`, `requireClientAccess` |
| `lib/dal/submissions.ts` | State machine — `submit`, `updateStatus`, `canTransition`. @@unique per client+form |
| `lib/dal/notifications.ts` | `listNotifications`, `markRead`, `markAllRead`. No soft-delete on Notification |
| `lib/dal/analytics.ts` | `getDashboardStats`, `getStatusBreakdown`, `getSubmissionTrend`, `getRecentActivity`, `getTopClientsByActivity` |
| `lib/dal/team.ts` | `createTeamMember`, `assignTeamToClient`, `unassignTeamFromClient` |
| `lib/dal/password-reset.ts` | `createPasswordResetToken`, `resetPassword` (bumps tokenVersion + revokes sessions) |
