# ClientConnect — Agent Instructions

## Commands

| What | Command |
|------|---------|
| Dev server | `npm run dev` (port 3000) |
| Typecheck | `npm run typecheck` |
| Build | `npm run build` (slow, use for final verify) |
| Lint | `npm run lint` (~30s) |
| All tests | `npm test` (vitest, sequential, needs Postgres) |
| Single test file | `npx vitest run tests/unit/pagination.test.ts` |
| Single test by name | `npx vitest run -t "rejects expired tokens"` |
| E2E | `npm run test:e2e` (Playwright, port 3001) |
| Audit | `npm run audit` (typecheck -> lint -> test) |
| DB migrate dev | `npm run db:migrate:dev -- --name <verb>_<entity>` |
| DB migrate deploy | `npm run db:migrate` |
| DB seed | `npm run db:seed` |
| DB studio | `npm run db:studio` |
| Prisma generate | `npx prisma generate` |

**CI** (`.github/workflows/ci.yml`): `typecheck -> lint -> test` (not `build`).  
**Pre-commit:** `typecheck -> build`. Lint + tests can run in parallel.

**Windows prisma generate:** may fail with `EPERM` on `.dll.node`. Kill node processes first (`taskkill /F /IM node.exe`), then run `npx prisma generate --no-engine`.

## Stack

- **Next.js 16** — middleware file is `proxy.ts` (not `middleware.ts`). No `src/` dir. `@/*` -> `./*`.
- **shadcn/ui v4 Radix Nova** — `components.json` style `"radix-nova"`, 45 components in `components/ui/`. Icons use `data-icon="inline-start"` / `data-icon="inline-end"` (CSS target, not prop).
- **Tailwind CSS 4** — `@import "tailwindcss"` in CSS, `@theme inline {}` block in `app/globals.css`, no `tailwind.config.ts`. oklch CSS variables. No `dark:` overrides — use semantic tokens.
- **Prisma 6 + Postgres** — singleton at `lib/db.ts` (global-cached for dev). 3 migrations committed. Run `prisma migrate deploy` on fresh DB.
- **React 19** — `useActionState` (not `useFormState`). `server-only` first import in every `lib/` module. Stubbed in tests via `resolve.alias` -> `tests/stubs/empty.ts`.
- **Zod 4** — `.email()` returns `string`, not `ZodString`. `.refine()` on email requires domain contains `.`. `safeParse` returns `{ success, error }` with `error.issues`.
- **ESLint 9** flat config at `eslint.config.mjs` — `eslint-config-next/core-web-vitals` + `typescript`.

## Architecture

```
proxy.ts -> Server Components -> DAL (lib/dal/*) -> Prisma
                                Server Actions -> DAL -> writeAudit() + notify()
                                Route Handlers -> DAL -> storage adapter
```

**DAL is the only door to the database.** Never call `prisma` from pages or actions. Pattern: `getCurrentUser()` / `requireSession()` -> `requireRole()` / `requireClientAccess()` -> plain DTOs. Reads wrapped in `cache()`. Mutations in `$transaction` with `writeAudit()` + `notify()` outside tx.

Soft deletes via `deletedAt: null` filter on User, Client, TeamMember, Form, Submission, File, Comment. **AuditLog has no `deletedAt`** (append-only).

**Docs** at `docs/` (`docs/README.md` has reading order). Code is source of truth; `prd.md` is legacy.

## Auth

Dual-token: JWT access (24h, `access_token` cookie) + opaque refresh (7d, SHA-256 in `Session`, `refresh_token` cookie). `User.tokenVersion` in JWT as `ver` — `getCurrentUser()` rejects stale versions on every DB call.

**Block/unblock:** `User.isActive` — `getCurrentUser()` returns null for inactive users. Login action rejects with "account blocked" message. Block/unblock bumps `tokenVersion` and revokes all sessions.

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

## User Management

- **Admin Users page:** `/admin/users` — search, filter by role/status, paginated table
- **User detail:** `/admin/users/[id]` — edit (name/email/role), block/unblock, reset password, delete
- **DAL:** `lib/dal/users.ts` — `listUsers`, `getUserDTO`, `updateUser`, `toggleBlockUser`, `adminResetPassword`, `deleteUser`
- Block/unblock invalidates sessions + bumps tokenVersion
- Reset password generates 14-char password, emails it, revokes all sessions

## shadcn/ui & Styling

- Forms use `FieldGroup` + `Field` + `FieldLabel` from `components/ui/field.tsx`.
- Validation: `data-invalid` on `Field`, `aria-invalid` on control.
- Use `flex flex-col gap-*` — never `space-y-*`.
- Use `Card`/`CardContent`/`CardHeader` — never `border rounded-lg`.
- Use `cn()` from `lib/utils.ts` for conditional classes.
- Icons: `lucide-react`. Inside buttons: `<Icon data-icon="inline-start" />`.

### Brand (in `app/globals.css`)

- **Body font:** Manrope (`--font-manrope`). **Heading:** Noto Serif (`--font-heading`, `h1-h6 @apply font-heading`).
- **Page titles:** `text-3xl font-heading tracking-wide`.
- **Palette:** Warm sand/ochre — all tokens are `oklch` CSS variables in `:root` and `.dark`.

## Notifications

19 event types in `lib/notifications/types.ts`. Adding a new event requires updating 4 files:
1. `NotificationType` enum in `prisma/schema.prisma`
2. Discriminated union in `lib/notifications/types.ts`
3. `computeRecipients()` in `lib/notifications/audience.ts`
4. `renderTemplate()` in `lib/notifications/templates.ts`

Transport: SSE at `/api/notifications/stream` (`GET`). Polls DB every 8s. Falls back to polling in dev. Bell component: `useNotifications(enabled)` hook in `hooks/use-notifications.ts`.

## Chat System

- Comments are 2-level threaded (top-level + replies, no deeper nesting)
- **Live chat:** `components/comments/live-chat.tsx` — fetches initial tree via `GET /api/comments`, then streams new messages via SSE `GET /api/comments/stream?clientId=`
- SSE polls DB every 3s. Falls back to HTTP polling on 3+ SSE failures
- Delete: admin or author can delete. Soft-delete with optimistic UI removal.
- `components/comments/actions.ts` `revalidateForClient()` must cover admin, team, and client views

## Format & Storage

- **Forms:** `FormSchemaV1` (Zod) stored as Prisma `Json`. `validateSubmission(schema, data)` returns Zod `SafeParseResult`. Adding a field type -> update `lib/forms/schema.ts` + `lib/forms/validate.ts` + `FieldRenderer`.
- **Files:** Storage adapter auto-wired: `S3Adapter` when `S3_*` or `R2_*` env vars present, else `LocalFsAdapter(root=./storage)` in dev. Production throws without S3/R2 config. Magic-byte validation before write. Soft delete on DB row; storage objects kept.
- **Rate limiter:** Hybrid — Upstash Redis when configured, in-memory token bucket fallback. API: `rateLimit(key, bucket)` and `rateLimitAll(...checks)`.
- **Email:** Nodemailer. Priority chain: Gmail OAuth2 (`GOOGLE_CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN` + `GMAIL_USER`) -> Gmail App Password (`GMAIL_USER` + `GMAIL_APP_PASSWORD`) -> Generic SMTP. Stubs to console in dev if unconfigured. Silent drop in production.

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
- **`server-only`** must be first import in every `lib/` module.
- **`AuditLog` is append-only** — no `deletedAt`, no update, no cascade delete.
- **Pagination:** `lib/dal/pagination.ts` — `DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=100`, helper `paginationParams()` for `take`/`skip`.
- **Client routes** use `[slug]` dynamic segment — `requireClientAccessBySlug(slug)` resolves to `clientId`.
- **Notification list API** returns `{ items, unread }` shape — always format, even with search/filter.
- **`.env.example`** is the authoritative env var catalog. `DATABASE_URL`, `AUTH_JWT_SECRET` required.
- **Login action** uses `select` (not `include`) — add new fields to both the Prisma query and the type annotation.
- **`saveDraft` in DAL accepts `{ clientId, formId, formData }`** — no `submissionId`. The server action wrapper mirrors this.
- **Server action files** at `app/(admin)/admin/clients/[id]/actions.ts` and `app/(admin)/admin/team/[id]/actions.ts` are easy to forget when building those pages.
- **Migration naming:** use `snake_case` (`add_user_is_active` not `addUserIsActive`).
- **Scripts** in `scripts/`: `seed-test-data.ts`, `reset-admin.ts`, `ensure-e2e-admin.ts`, `smoke-auth.ts`, `count.ts`.
