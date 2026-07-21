# ClientConnect — Agent Instructions

> **Trust hierarchy when sources conflict:** code > this file > `docs/` > `prd.md`. **`README.md` is stale** — it claims "NextAuth 5" (actually a custom `jose`-based JWT auth) and lists wrong test accounts (`admin@connectio.test`). Use the test accounts below, not README's.

## Commands

| What | Command |
|------|---------|
| Dev server | `npm run dev` (port 3000) |
| Typecheck | `npm run typecheck` (fast) |
| Build | `npm run build` (slow — final verify only) |
| Lint | `npm run lint` |
| Test (unit+integration) | `npm test` (vitest, sequential, needs Postgres `connectio_test` DB with migrations applied) |
| Test DB setup | `$env:DATABASE_URL='postgresql://.../connectio_test'; npx prisma migrate deploy` (run once after new migrations) |
| Single test file | `npx vitest run tests/unit/pagination.test.ts` |
| Single test by name | `npx vitest run -t "rejects expired tokens"` |
| E2E | `npm run test:e2e` (Playwright, port 3001, 1 worker, sequential) |
| Audit | `npm run audit` (typecheck → lint → test — CI uses this order) |
| DB migrate dev | `npm run db:migrate:dev -- --name <verb>_<entity>` (snake_case) |
| DB migrate deploy | `npm run db:migrate` |
| DB seed | `npm run db:seed` |
| DB studio | `npm run db:studio` |
| Prisma generate | `npx prisma generate` |

**Windows prisma generate** may fail with `EPERM` on `.dll.node`. Kill node processes first (`taskkill /F /IM node.exe`), then `npx prisma generate --no-engine`.

## Stack

- **Next.js 16** — middleware is `proxy.ts` (not `middleware.ts`). No `src/` dir. `@/*` → `./*`.
- **shadcn/ui v4 Radix Nova** — `components.json` style `"radix-nova"`, ~45 components in `components/ui/`. Icons: `data-icon="inline-start"`.
- **Tailwind CSS 4** — `@import "tailwindcss"` in CSS, `@theme inline {}` block in `app/globals.css`. No `tailwind.config.ts`. oklch CSS variables. No `dark:` overrides — use semantic tokens.
- **Prisma 6 + Postgres** — singleton at `lib/db.ts` (global-cached). DB migrations committed.
- **React 19** — `useActionState` (not `useFormState`). `server-only` first import in every `lib/` module.
- **Zod 4** — `.email()` returns `string`, not `ZodString`. `.refine()` on email requires domain contains `.`. `safeParse` returns `{ success, error }` with `error.issues`.
- **ESLint 9** flat config at `eslint.config.mjs`.

## Architecture

```
proxy.ts → Server Components → DAL (lib/dal/*) → Prisma
           Server Actions     → DAL → writeAudit() + notify()
           Route Handlers     → DAL → storage adapter
```

**`proxy.ts` is optimistic-only** — verifies the JWT via crypto (no DB lookup), redirects unauthenticated users. Real authorization happens in the DAL (`requireSession()` → `requireRole()` / `requireClientAccess()`). Don't add DB work to the proxy; it runs on every request including prefetches.

**DAL is the only door to the database.** Never call `prisma` from pages or actions. Pattern: `requireSession()` → `requireRole()` / `requireClientAccess()` → plain DTOs. Reads wrapped in `cache()`. Mutations in `$transaction` with `writeAudit()` + `notify()` outside tx.

Client-only heavy components (palettes, chat, carousels) use `next/dynamic` with `ssr: false` — defer their bundle from the critical path.

Soft deletes via `deletedAt: null` filter on User, Client, TeamMember, Form, Submission, File, Comment. **AuditLog is append-only** — no `deletedAt`, no update, no cascade delete.

Route groups: `(admin)`, `(team)`, `(client)`, `(auth)`. Layouts enforce via `requireRole()`. `/invite/[slug]` is intentionally public (no proxy protection).

`not-found.tsx` exists at global, admin, team, client, auth, and invite levels. `forbidden()` from `next/navigation` works via `experimental.authInterrupts: true` in `next.config.ts`. `loading.tsx` exists at every deep route.

## Auth

Dual-token: JWT access (24h, `access_token` cookie, HS256 with `jose`) + opaque refresh (7d, SHA-256 hashed in `Session` model, `refresh_token` cookie). `User.tokenVersion` in JWT as `ver` — `getCurrentUser()` rejects stale versions on every DB call. Block/unblock bumps `tokenVersion` and revokes all sessions.

Roles: `SUPER_ADMIN`, `TEAM_MEMBER`, `CLIENT`.

Refresh: `POST /api/auth/refresh` — CSRF-protected (Origin check), rate-limited 60/min per IP, rotated in `$transaction`. Boot env validation in `instrumentation.ts`.

**`requireRole`/`requireSession` throw Next.js redirect/notFound/forbidden errors** — never wrap in try/catch. They must propagate to the framework.

**API routes need explicit `getCurrentUser()` guard** — DAL functions silently return empty/null for unauthenticated users rather than throwing.

**Password reset** uses 6-digit OTP (SHA-256 hashed, 10-min expiry, 5/min rate-limit): `lib/dal/password-reset.ts` → `createPasswordResetOtp` / `verifyResetOtp` / `resetPassword`. 3-step client form at `app/(auth)/reset-password/`. OTP template uses `{{otp}}` variable, seeded in `scripts/seed-email-templates.ts`.

## Styling Conventions

- **Forms:** `FieldGroup` + `Field` + `FieldLabel` from `components/ui/field.tsx`. Validation: `data-invalid` on `Field`, `aria-invalid` on control.
- **Layout:** `flex flex-col gap-*` — never `space-y-*`. Use `Card`/`CardContent`/`CardHeader` — never bare `border rounded-lg`.
- **Classes:** `cn()` from `lib/utils.ts`. Icons: `lucide-react` with `<Icon data-icon="inline-start" />`.
- **Brand:** Body font `--font-manrope` (Manrope), heading `--font-noto-serif` (Noto Serif), `h1-h6 @apply font-heading`. Page titles: `text-3xl font-heading tracking-wide`. Palette: warm neutral oklch CSS variables in `:root` and `.dark`.

## Notifications

37 notification events in the Prisma `NotificationType` enum, mirrored 1:1 in the TypeScript discriminated union at `lib/notifications/types.ts`. Adding a new event requires updating 4 files: `prisma/schema.prisma` (enum), `lib/notifications/types.ts` (union), `lib/notifications/audience.ts` (recipients), `lib/notifications/templates.ts` (render). The union is exhaustive — TypeScript's switch exhaustiveness in `audience.ts` enforces coverage.

Transport: SSE at `/api/notifications/stream` (GET, polls DB every 8s, re-auths each cycle — blocks/rejects close the stream). Falls back to HTTP polling in dev. Bell component: `useNotifications(enabled)` hook in `hooks/use-notifications.ts`.

Notification list API returns `{ items, unread }` shape — always format both, even with search/filter.

## Chat (Comments)

2-level threaded (top-level + replies). SSE transport at `/api/comments/stream?clientId=` (polls DB every 3s, falls back to HTTP polling on 3+ SSE failures). Soft-delete with optimistic UI removal. `revalidateForClient()` in `components/comments/actions.ts` must cover admin, team, and client views.

## Forms & Storage

- **Forms:** `FormSchemaV1` stored as Prisma `Json`. `validateSubmission(schema, data)` returns Zod `SafeParseResult`. Adding a field type → update `lib/forms/schema.ts` + `lib/forms/validate.ts` + `components/forms/field-renderer.tsx`. 13 field types supported (text, textarea, number, email, url, select, multiselect, radio, checkbox, date, datetime, file, heading).
- **Form editor** at `app/(admin)/admin/forms/[id]/` includes **Send form** dialog (`components/forms/send-form-dialog.tsx`) that assigns forms to users. `sendFormToUsers(formId, userIds)` in `lib/dal/forms.ts` auto-creates Client records for non-client users (team members, admins), creates draft submissions, and fires `FORM_ASSIGNED` notifications. Recipient picker uses `listUsersForPicker()` from `lib/dal/users.ts`.
- **Files:** Storage adapter auto-wired: `S3Adapter` when `S3_*` or `R2_*` env vars present, else `LocalFsAdapter(root=./storage)` in dev. Production throws without S3/R2 config. Magic-byte validation before write. Soft delete on DB row; storage objects kept. **Upload POST:** DB row creation in try/catch with `storage.delete(storageKey)` on failure. Never leak `storageKey` or raw `err.message`.
- **Rate limiter:** Hybrid — Upstash Redis when configured, in-memory token bucket fallback. `rateLimit(key, bucket)` and `rateLimitAll(...checks)`.
- **Email:** Nodemailer. Priority: Gmail OAuth2 → Gmail App Password → Generic SMTP. Stubs to console in dev if unconfigured. Silent drop in production.

## Testing

- Needs Postgres (`connectio_test` DB). Vitest runs sequentially (`fileParallelism: false`).
- Integration tests (`tests/integration/`) truncate all tables between tests **and require a `prisma://` or `prisma+postgres://` DATABASE_URL** (Prisma Accelerate) — they fail with local Postgres URLs.
- Unit tests (`tests/unit/`) run offline and pass with any DATABASE_URL.
- E2E: Playwright on port 3001, sequential, 1 worker.
- `tests/stubs/empty.ts` mocks `server-only` in vitest config via `resolve.alias`.
- `tests/setup.ts` mocks `next/headers` globally, sets `AUTH_JWT_SECRET`, `DATABASE_URL`. Tests swap user via `globalThis.__ccTestToken`.
- **Seed test data:** `npx tsx scripts/seed-test-data.ts` (idempotent; `WIPE_TEST_DATA=1` to reset). Creates 5 accounts across 3 roles with clients, forms, submissions, comments, files, notifications.

### Test Accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@clientconnect.com` | `Admin123!` | SUPER_ADMIN |
| `team@clientconnect.com` | `Team123!` | TEAM_MEMBER |
| `alice@acme.com` | `Client123!` | CLIENT |
| `bob@globex.com` | `Client123!` | CLIENT |
| `carol@initech.com` | `Client123!` | CLIENT |

## Shared Primitives

| File | What |
|------|------|
| `components/shared/pagination.tsx` | Prev/Next pagination with `buildHref` callback |
| `components/shared/status-badge.tsx` | `StatusBadge`, `InviteStatusBadge`, `UserRoleBadge`, `ActiveBadge` |
| `components/shared/breadcrumbs.tsx` | `Breadcrumbs` with segment array |
| `lib/format.ts` | `formatDate`, `formatDateTime`, `formatRelativeTime`, `formatFileSize`, `formatCount` |

## Admin-Specific Items

Every admin feature follows the same pattern: `app/(admin)/admin/<feature>/page.tsx` (server component) → `lib/dal/<feature>.ts` (DAL with `requirePermission()`) → `actions.ts` (server actions). UI pages use `Card`/`Table`/`Select`/`Badge` from shadcn and `flex flex-col gap-*` layout. Only the cross-cutting features worth explicit references:

| Feature | File | Notes |
|---------|------|-------|
| Audit chain verification | `lib/dal/audit-chain.ts` + `app/(admin)/admin/audit-log/chain/` | SHA-256 hash chain over all audit entries — `writeAudit()` in `lib/audit.ts` computes hashes automatically. Backfill script: `scripts/backfill-audit-hashes.ts` |
| GDPR / erasure | `lib/dal/gdpr.ts` → functions: `requestErasure()`, `approveErasure()`, `denyErasure()`, `exportMyData()`, `exportUserDataByAdmin()` |
| SSO / SCIM | `lib/dal/sso.ts`, `lib/dal/scim.ts`, `app/api/auth/sso/`, `app/api/scim/v2/` | See [SSO / SCIM Details](#sso--scim-details) below |
| Webhooks & forwarding | `lib/dal/webhooks.ts`, `lib/webhooks/deliver.ts` | `writeAudit()` calls `dispatchWebhooks('audit', ...)` fire-and-forget. Admin UI at `/admin/webhooks` |
| Email logging | `lib/email.ts` | `sendEmail()` writes `EmailLog` rows (provider, status, category) for every email. Admin UI at `/admin/email-logs` |
| Email templates | `lib/dal/email-templates.ts` | `renderStoredTemplate(key, vars, fallback)` with `{{var}}` substitution. Seed: `scripts/seed-email-templates.ts` |
| 2FA / MFA | `lib/auth/totp.ts`, `lib/dal/two-factor.ts`, `lib/auth/tokens.ts` | TOTP (RFC 6238): base32 + HMAC-SHA1. `signMfaToken()`/`verifyMfaToken()` issue short-lived `mfa_token` cookie between password and challenge. Enrollment on client profile. |
| Permissions (RBAC) | `lib/auth/permissions.ts` | 47 typed permissions across 3 roles. `requirePermission()` used in newer DAL modules; `requireRole()` still used in layouts, server actions, and older DAL functions (submissions, analytics). Both coexist — check which the surrounding code uses. Admin viewer: `/admin/roles` |
| Rate limiter | `lib/ratelimit.ts` | Hybrid Upstash Redis / in-memory token bucket. Protects login, refresh, forgot-pw, reset-pw, invite reg, SSO callback by IP + email. |
| Client branding | `lib/dal/client-settings.ts` | Portal branding (logo, color, title, custom CSS) applied in `app/(client)/client-shell.tsx`. Admin: `/admin/clients/[id]/branding` |
| Bulk user ops | `lib/dal/users.ts` | `bulkToggleBlockUser()`, `bulkDeleteUser()`. UI uses `name="userIds"` checkboxes + `formAction` buttons on users page. |
| API keys | `lib/dal/api-keys.ts` | General-purpose API key CRUD. Admin: `/admin/api-keys` |
| Global search | `app/api/admin/search/route.ts` | Unified search across users, clients, submissions. Admin: `/admin/search` |
| Cmd+K palette | `components/admin/command-palette.tsx` | Wired in admin shell — add new pages to the `PAGES` array |
| Pagination | `lib/dal/pagination.ts` | `DEFAULT_PAGE_SIZE=20`, `MAX_PAGE_SIZE=100`, helper `paginationParams()` |
| CSV export | `components/admin/export-csv-button.tsx` + `/api/admin/export` |

## SSO / SCIM Details

- **SAML ACS** (`POST /api/auth/sso/:id/acs`) receives the IdP form POST, parses NameID from XML, logs user in (or JIT-provisions).
- **OIDC callback** (`GET /api/auth/sso/:id/callback`) exchanges code for ID token at the provider's token endpoint, decodes JWT payload, logs user in.
- **Initiate endpoint** (`GET /api/auth/sso/:id/initiate`) is the user-facing SSO button target. For SAML: redirects to the configured IdP SSO URL. For OIDC: fetches the discovery URL to find the authorization endpoint, then redirects with state/scope params.
- **SCIM bearer auth** uses SHA-256 hashed API keys stored in `ScimApiKey` table. `verifyScimApiKey()` does constant-time hash comparison. Keys shown once on creation.
- **SCIM User operations** support `POST` (create), `GET` (list/filter), `PUT` (full update), `PATCH` (partial update), `DELETE` (soft-delete). Groups are read-only list.
- **JIT provisioning** creates users automatically on first SSO login with a temporary password and the provider's default role.
- **SSO provider deletion** is blocked if users are still linked to the provider. Unlink users first via admin.

## Key Gotchas

- **`typecheck` is fast, `build` is the real verification.** Run `typecheck` after every change; `build` for final verification.
- **RSC form action boundary:** In Server Components, `<form action={fn}>` cannot take an inline arrow function (`async (fd) => { await action(id, fd) }`) — it can't cross the RSC boundary. Use `action.bind(null, id)` on the server action. Also: `<form action>` return type must be `void | Promise<void>`, not `Promise<{success?, error?}>` — if the action returns state, extract the form into a client component using `useActionState`.
- **Radix `SelectItem value=""` throws** unconditionally. Use a sentinel like `value="all"` for "no filter" options, and adjust the filter logic to check `=== 'all'` before passing to the DB query.
- **`suppressHydrationWarning`** on `<html>` and `<body>` in `app/layout.tsx` — browser extensions (Grammarly, etc.) inject `data-*` attributes that cause hydration mismatches without it.
- **Route handler `req` param** — keep in signature even if unused (Next.js passes it).
- **Server actions with `(_prev, formData)` signature** (designed for `useActionState`) cannot be used directly as `<form action>` (expects `(formData) => void`). In a client component, use `useActionState`. In a server component, `.bind(null, id)` only works if the action's extra params come before `_prev`.
- **`writeAudit`'s `changes` field** only accepts `{ before?, after? }` — arbitrary keys like `via` will type-error.
- **`NotFoundError` constructor** takes a single argument (the resource name), e.g. `throw new NotFoundError('User')`.
- **Auth forms** use `<form action={action} noValidate>` with hidden inputs. Server action validates; `react-hook-form` provides `register()` for UI.
- **Client routes** use `[slug]` dynamic segment — `requireClientAccessBySlug(slug)` resolves to `clientId`.
- **Notify-on-mutation pattern:** `writeAudit()` + `notify()` go *outside* the `$transaction`, not inside — the transaction commits, then side-effects run.
- **Comments SSE stream** re-auths every poll cycle (see `app/api/notifications/stream/route.ts` for pattern) — blocks/rejects must close the stream.
- **`saveDraft` in DAL** accepts `{ clientId, formId, formData }` — no `submissionId`. Server action mirrors this.
- **Uploads responses:** never leak `storageKey` (internal paths) or raw `err.message`. Use generic error text.
- **Migration naming:** snake_case (`add_user_is_active` not `addUserIsActive`).
- **`lib/dal/` conventions:** login action uses `select` (not `include`) — add new fields to both the query and the type annotation. Admin server actions at `app/(admin)/admin/clients/[id]/actions.ts` and `app/(admin)/admin/team/[id]/actions.ts` need `requireRole('SUPER_ADMIN')`.
- **Scripts** in `scripts/`: `seed-test-data.ts`, `reset-admin.ts`, `ensure-e2e-admin.ts`, `smoke-auth.ts`, `count.ts`, `backfill-audit-hashes.ts`, `seed-email-templates.ts`.
- **Integration tests need Prisma Accelerate URL** — they fail with `Invalid datasource` error on plain `postgresql://` URLs. Unit tests don't require this.

## Known Issues & Defensive Patterns

- **Variable shadowing in `$transaction` callbacks**: If the outer scope has `user` from `requirePermission()` and the transaction re-fetches `const user = await tx.user.findUnique(...)`, the inner `user` shadows the admin's identity. The audit log ends up recording the victim as the actor. **Fix: rename outer to `admin`, inner to `target`/`erasureTarget`.** This was a real bug in `lib/dal/gdpr.ts:approveErasure`.
- **SCIM DAL functions intentionally have no inline guards** — auth is at the route level via `verifyScimApiKey()`.
- **DAL file adding a `getDistinct*` helper must also add its auth guard** — `getDistinctEmailCategories` initially missed the `requirePermission('audit:read')` call.
- **SSO form `spEntityId`**: The SSO provider form renders `spEntityId` in the General section. It was read by `createSsoAction` but silently dropped by `updateSsoAction`. Both now pass it through. When adding a new SSO config field, update both `createSsoProvider` and `updateSsoProvider` types.
- **Docs** at `docs/` (`docs/README.md` has reading order). Code is source of truth; `prd.md` is legacy. `REVIEW-*.md` files are archived design review feedback.`
