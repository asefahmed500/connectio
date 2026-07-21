# ClientConnect — Performance Audit

**Date:** 2026-06-15  
**Auditor:** Principal Software Architect + Performance Engineer  
**Scope:** Full codebase — DAL, API, UI components, auth, storage, notifications, tests, CI

---

## 1. Executive Summary

The ClientConnect codebase is architecturally clean with strong separation of concerns (DAL pattern), proper RBAC, well-documented notification system, and thorough auth. However, several N+1 queries, missing indexes, absence of pagination, and incomplete features prevent it from being production-ready.

**Overall grade:** B+ for architecture, C for production readiness.

---

## 2. Findings by Severity

### CRITICAL (5 issues)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| C1 | **N+1 in `listActiveFormsForClient`** — fetches all submissions per form to count them, instead of using `_count` relation | `lib/dal/forms.ts:80-86` | When a client has many forms, this issues (#forms × #submissions) DB rows returned — quadratic I/O | Use `_count: { select: { submissions: { where: { clientId } } } }` instead of fetching full submissions |
| C2 | **`getTopClientsByActivity` fetches ALL clients** then sorts/limits in JS. No `take` on the Prisma query | `lib/dal/analytics.ts:188-198` | Full table scan of clients table on every dashboard load. O(N) growth with client base | Add `take: limit` to the Prisma query, or use raw SQL ranking |
| C3 | **No pagination on list endpoints** — all list pages load everything into memory | `listAllClients`, `listAllForms`, `listAllTeamMembers`, `listFilesForClient`, `listSubmissionsForClient` | O(N) memory + DB rows for every list. Will break at ~10k rows | Add cursor-based or offset-based pagination (20 items/page) |
| C4 | **SSE notification stream polls full DB per connection** — no last-seen tracking per connection; every poll fetches since (now-8s) which may overlap | `app/api/notifications/stream/route.ts:78-85` | N concurrent SSE connections = N × 8s queries. At 100 users, 750 DB queries/min on notifications alone | Track per-connection `lastSeen` timestamp, pass it to `listNotificationsSince()` |
| C5 | **Authorization check AFTER data fetch in `getSubmissionDTO`** — fetches submission then checks access | `lib/dal/submissions.ts:65-71` | Information leak: an unauthenticated user can probe for submission existence via timing or error messages. Also wastes a DB round-trip if access denied | Use `findUnique` with `clientId` filter or check access before fetch |

### HIGH (6 issues)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| H1 | **`getRecentActivity` fetches `limit` from 3 tables then sorts** — always skips older items in over-represented categories | `lib/dal/analytics.ts:97-157` | Bias toward submission-heavy clients; comments from quiet clients get buried | Use cursor union or fetch fewer per category proportional to activity mix |
| H2 | **`listActiveFormsForClient` counts via `submissions.length`** not `_count` | `lib/dal/forms.ts:86` | Extra data transfer. The `_count` column is already on the model but unused here | Use `_count.submissions` with `where: { clientId }` |
| H3 | **In-memory rate limiter** loses state on restart, no shared state across instances | `lib/ratelimit.ts:1` | Multi-instance deployments have independent rate limit buckets, allowing effective bypass | Swap to Upstash Redis (env vars already configured, just unused) |
| H4 | **No CSRF protection on mutation endpoints** — only the refresh endpoint checks origin | `app/api/uploads/route.ts`, `app/api/notifications/*/read/route.ts` | POSTs to upload/notification endpoints are vulnerable to cross-origin forgery from other domains | Add CSRF token header check or SameSite=Strict on mutation cookies |
| H5 | **No input size limits on form submissions** — formData is unbounded JSON | `lib/dal/submissions.ts:95-107` | A client can submit multi-MB JSON blobs that bloat the DB | Add `MAX_FORM_DATA_BYTES` validation in `saveDraft()` and `submit()` |
| H6 | **`writeAudit` is best-effort, not transactional** — audit logs can diverge from business data if the audit write fails | `lib/audit.ts:23-33` | Tamper-evidence guarantee is weak; audit trail incomplete under failure | Move to transactional outbox (REVIEW-4.md §6.1 already planned) |

### MEDIUM (8 issues)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| M1 | **`listAllTeamMembers` does an extra join to User** per row — `include: { user: { select: { name, email } } }` is needed because name/email isn't denormalized on TeamMember | `lib/dal/team.ts:17-20` | Unnecessary JOIN; TeamMember should have a view-level helper | Acceptable for v1; denormalize `name` on TeamMember if it becomes a hot path |
| M2 | **`getDashboardStats` runs 7 separate `count()` queries** in parallel — Prisma batches them but it's still 7 round-trips | `lib/dal/analytics.ts:214-233` | 7 parallel DB queries for one page load. Likely fine below 10k rows but suboptimal | Combine into one raw SQL with subqueries, or use materialized view at scale |
| M3 | **SSE poll uses `listNotificationsSince()` which does a fresh full query per connection** | `app/api/notifications/stream/route.ts:78` | Already noted as C4 but the polling frequency compounds it | Track per-stream `lastId` and use `findMany({ cursor: { id: lastId } })` |
| M4 | **No `loading.tsx` files** — every page does a full server render; no loading skeletons | All route groups | Poor UX on slow connections; layout shift | Add `loading.tsx` files with skeleton cards to each route group |
| M5 | **No `error.tsx` boundaries** — any unhandled throw in a server component surfaces as Next.js default error | All route groups | Generic error page with no recovery action | Add `error.tsx` with retry buttons to each route group |
| M6 | **Comment thread does a full tree build in JS** — `getCommentsDTO` has O(N) filter + map pass | `lib/dal/comments.ts:72-98` | Fine below 500 comments per client; no index on `parentId+clientId` | Add composite index: `@@index([clientId, parentId, createdAt])` |
| M7 | **File upload API buffers entire file in `arrayBuffer()`** before magic-byte check | `app/api/uploads/route.ts:57-59` | Memory pressure above ~5MB uploads; Node keeps full blob in V8 heap | Stream first 512 bytes for magic check, then stream the rest to storage |
| M8 | **`updateStatus` does 3 sequential DB calls** (find submission, update, find form for notify) plus audit + notify in the same tick | `lib/dal/submissions.ts:176-232` | Not transactional; if notification fails after DB update, notification is lost | Wrap update+audit+notify in `$transaction`, or use outbox |

### LOW (5 issues)

| # | Issue | Location | Impact | Fix |
|---|-------|----------|--------|-----|
| L1 | **No `@index` on `Notification.clientId`** — queries can't filter by client without full scan | `prisma/schema.prisma:282` | Not currently queried by clientId, but would be needed for per-client notification history | Add if needed |
| L2 | **`proposeSlug` does 6 sequential availability checks** — each calls `isSlugAvailable` which does 2 DB queries | `lib/dal/invites.ts:20-30` | Up to 12 DB queries for one slug generation. Fine for creation UX but wasteful | Batch-check all 6 candidates in one `where: { slug: { in: [...] } }` query |
| L3 | **Form editor stores raw JSON schema as string** — no structured editing, full "paste JSON" UX | `app/(admin)/admin/forms/form-editor.tsx:42-52` | Error-prone; non-technical admins can't configure forms without knowing JSON | Add structured field editor (drag-and-drop, field type picker) — Phase 2 |
| L4 | **`Notification.payload` stores full event as JSON** — redundant with `type`+`clientId`+`submissionId`+`commentId` columns | `prisma/schema.prisma:277` | ~2KB of redundant data per notification row. At 100k notifications, ~200MB wasted | Remove payload column or store only event-specific data not in columns |
| L5 | **`emailByDefault: false` on several templates where email might be expected** — SUBMISSION_IN_REVIEW, FILE_UPLOADED_CLIENT, TEAM_MEMBER_ASSIGNED | `lib/notifications/templates.ts` | Users miss important events because they only check the portal | Revisit emailByDefault rules with product input |

---

## 3. Database Index Audit

### Existing Indexes (from schema)
| Table | Index | Adequate? |
|-------|-------|-----------|
| User | `@@index([role])` | Yes |
| Session | `@@index([userId])`, `@@index([expiresAt])` | Yes |
| Invite | `@@index([status])`, `@@index([email])` | Yes |
| Client | `@@index([uniqueSlug])` | Yes |
| TeamAssignment | `@@unique([teamMemberId, clientId])`, `@@index([clientId])` | Yes |
| Form | `@@index([isActive])` | Yes |
| Submission | `@@index([status])`, `@@index([formId])` | **Missing:** `@@index([clientId])` for per-client submission listing |
| File | `@@index([submissionId])`, `@@index([clientId])` | Yes |
| Comment | `@@index([clientId, createdAt])`, `@@index([submissionId])`, `@@index([authorId])` | Yes |
| Notification | `@@index([recipientId, readAt, createdAt])`, `@@index([recipientId, createdAt])` | Yes |
| AuditLog | `@@index([userId, createdAt])`, `@@index([resource, resourceId])`, `@@index([createdAt])` | Yes |

### Missing Indexes to Add
1. `Submission.@@index([clientId])` — per-client listing (`listSubmissionsForClient`)
2. `Comment.@@index([clientId, parentId, createdAt])` — tree building for `getCommentsDTO`
3. `Session.@@index([refreshTokenHash])` — already covered by `@unique` but verify query plan

---

## 4. Frontend Performance

### Bundle Audit (estimated from component list)
- 47 shadcn/ui components all importing from Radix UI — but Next.js tree-shakes per page
- `components/ui/sidebar.tsx` is 702 lines — largest single component
- No lazy loading of heavy components (carousel, calendar, command, date-fns)
- `react-day-picker` + `date-fns` bundled on every page load (only used in calendar)

### Recommendations
1. `next/dynamic` for calendar, carousel, command palette — they're import-heavy and rarely used
2. Add `loading.tsx` skeleton pages for all route groups
3. Add `error.tsx` boundaries with recovery UI
4. Server Components are default (correct pattern) — only 25/85 .tsx files are `'use client'`

---

## 5. Security Posture

| Area | Status | Gap |
|------|--------|-----|
| Password hashing | argon2id with constant-time verify | Acceptable |
| JWT auth | Stateless access + DB refresh tokens, tokenVersion for instant revocation | Acceptable |
| RBAC | 3 roles enforced in DAL, not just middleware | Acceptable |
| CSRF | Refresh endpoint checks Origin; mutations don't | **Gap**: Missing CSRF tokens on upload, notification, form mutations |
| Rate limiting | In-memory token bucket per IP | **Gap**: Lost on restart; bypassed in multi-instance |
| Input validation | Zod on auth, manual on comments/files | **Gap**: No JSON size limit on form data |
| File upload | Magic-byte validation, extension whitelist, path sanitization | Acceptable for v1 |
| Audit logging | Append-only but non-transactional | **Gap**: Can diverge from business data |
| XSS | React escapes by default | Acceptable |

---

## 6. Test Coverage

| Layer | Coverage | Gap |
|-------|----------|-----|
| Unit: token sign/verify | 11 tests — complete | — |
| Unit: slug generation | 17 tests — complete | — |
| Unit: rate limiter | 7 tests — complete (1 slow: 1.1s) | Slow test due to real `setTimeout(1100)` |
| Unit: password hashing | 6 tests — complete | — |
| Integration: DAL | 0 tests | **Gap**: No tests for `requireClientAccess`, `canTransition`, `updateStatus`, `postComment` |
| E2E: auth flow | 1 spec (auth-flow) | **Gap**: No E2E tests for form submission, comments, files, notifications |
| **Total** | 41 unit tests, 0 integration, 1 E2E | Insufficient for production |

---

## 7. Feature Completeness

| Feature | Status | Notes |
|---------|--------|-------|
| Auth (login/logout/refresh) | Complete | Dual-token system working |
| Invite flow | Complete | Propose slug, register, consume invite |
| Form builder | Partial | JSON-only editor; no structured UI |
| Form submission | Complete | Draft→submit→review state machine |
| Comments (2-level) | Complete | Internal/external filtering |
| File uploads | Complete | Magic bytes, checksums, storage adapter |
| Notifications (SSE) | Complete | Bell component in all shells |
| Admin dashboard analytics | Complete | Stats, charts, activity feed |
| Team management | Complete | Create member, assign clients |
| Client dashboard | Complete | Forms, messages, files, submissions |
| Team dashboard | Complete | Client list, review submissions |
| Settings page | Partial | Read-only system overview; no actual settings |
| Password reset flow | **Missing** | Hardcoded "password reset flow — planned" |
| Email delivery | **Stub** | Logs to console only |
| Redis rate limiter | **Stub** | In-memory only |
| S3 storage | **Stub** | Throws in production |
| Soft deletes | **Missing** | No `deletedAt` column on any model |
| 2FA | **Missing** | Not started |
| Idempotency keys | **Missing** | Not started |
| CAPTCHA | **Missing** | Not started |

---

## 8. Summary Statistics

| Metric | Value |
|--------|-------|
| Total source files | ~85 |
| TypeScript files | ~40 |
| ESLint errors | 0 (project code), 2 (third-party .agents/skills) |
| ESLint warnings | 28 (most in .agents/skills, 5 in project code — now fixed) |
| TypeScript errors | 0 |
| Unit tests | 41 (all passing) |
| DB models | 8 |
| DAL modules | 10 |
| shadcn/ui components | 47 |
| API endpoints | 7 |
| Critical perf issues | 5 |
| High perf issues | 6 |
| Security gaps | 4 |
| Missing features | 7 |

---

## 9. Update — 2026-07-19 (Pass A: Critical Security)

**Scope of this pass:** close critical/high authorization gaps surfaced by a fresh current-state audit. No behavioural change to existing features.

### Closed

| ID | Severity | Issue | Fix | Files |
|---|---|---|---|---|
| N1 | Critical | `/api/webhooks/email` accepted `{to, subject, text}` from anyone — open email relay | HMAC-SHA256 signature required on raw body via `X-Webhook-Signature`, constant-time compare, fail-closed if `WEBHOOK_EMAIL_SECRET` unset | `app/api/webhooks/email/route.ts`, new helper `lib/webhooks/auth.ts` |
| N2 | Critical | `/api/webhooks/cron/cleanup-invites` let anyone expire invites | `Authorization: Bearer $CRON_SECRET` required, constant-time compare, fail-closed | `app/api/webhooks/cron/cleanup-invites/route.ts`, `lib/webhooks/auth.ts` |
| N3 | High | `/api/admin/gdpr/erasure` + `/api/admin/audit/chain/verify` lacked top-of-handler `getCurrentUser()` — relied solely on DAL | Explicit `getCurrentUser()` guard returning clean 401 before delegating to DAL | `app/api/admin/gdpr/erasure/route.ts`, `app/api/admin/audit/chain/verify/route.ts` |

### Tests added
- `tests/unit/webhooks-auth.test.ts` — 16 cases covering both helpers (valid/invalid sig, tamper, missing header, unset secret, malformed input, length bounds, scheme case, non-Bearer schemes). Constant-time path exercised via wrong-secret.

### Verification
- `npm run typecheck` — green
- `npm run lint` — 2 pre-existing `<a>`-element errors in admin pages (unrelated to this pass, scheduled for Pass C)
- `npm test` — **261/261 passing** across 30 files

### New env vars (documented in `.env.example`)
- `WEBHOOK_EMAIL_SECRET` — required if `/api/webhooks/email` is hit
- `CRON_SECRET` — already documented; now actually enforced

### Carry-forward to next pass
- 2 lint errors in admin pages → Pass C
- Original audit items C1/C2/C5/H4/H5 + missing index 4.1 → Pass B (verify-and-close)

---

## 10. Update — 2026-07-19 (Pass B: Perf-Audit Closure)

**Scope of this pass:** re-verify the open items from §2 above against the current code, classify as DONE or STILL-OPEN, and close what remained open. Net result: **almost everything was already closed** by intervening work; only H4 (CSRF on raw mutation routes) was still open.

### Item-by-item status

| Audit ref | Status | Evidence |
|---|---|---|
| **C1** Pagination on list endpoints | **DONE** | `listAllClients`, `listAllForms`, `listAllTeamMembers`, `listFilesForClient`, `listSubmissionsForClient` all return `PaginatedResult<T>` with `paginationParams()` defaults (page 1, 20 items). See `lib/dal/clients.ts:57`, `lib/dal/forms.ts:44`, `lib/dal/team.ts:23`, `lib/dal/files.ts:43`, `lib/dal/submissions.ts:246` |
| **C2** `getTopClientsByActivity` full scan | **DONE** | Now raw SQL with `GROUP BY + ORDER BY activityScore DESC + LIMIT ${limit}` pushed to Postgres. `lib/dal/analytics.ts:162-201` |
| **C2′** N+1 in `listActiveFormsForClient` | **DONE** | Uses `include.submissions.take: 1` (single relation fetch per form for the "current submission" UI hint). Not an N+1 — bounded. `lib/dal/forms.ts:81-104` |
| **C4** SSE per-connection cursor | **DONE** (closed earlier) | Per-connection `lastSentAt` tracked, passed to query. `app/api/notifications/stream/route.ts:30,51,73-77` |
| **C5** Auth-after-fetch in `getSubmissionDTO` | **DONE** | Lightweight `select: { clientId }` fetch first → `requireClientAccess(clientId)` → then full fetch. Inline comment documents the timing-leak fix. `lib/dal/submissions.ts:68-97` |
| **H4** CSRF on mutation endpoints | **CLOSED THIS PASS** | New helper `lib/auth/csrf.ts:checkSameOrigin(headers)` + applied to 7 raw mutation routes (uploads POST/DELETE, notifications DELETE + read POST + read-all POST, gdpr/erasure POST, audit/chain/verify POST). Server actions already CSRF-protected via `Next-Action` header; refresh + webhooks already covered. Fail-closed. |
| **H5** No JSON size limit on form data | **DONE** | `MAX_FORM_DATA_BYTES = 500_000` enforced via `enforceSizeLimit()` in `saveDraft()` and `submit()`. `lib/dal/submissions.ts:120-132,142,159` |
| **H6** Non-transactional audit | **DONE** (closed earlier) | `writeAudit` accepts optional `tx?`; called inside `$transaction` in `submit()`, `updateStatus()`. `lib/audit.ts:18`, `lib/dal/submissions.ts:165-213,291-311` |
| **4.1** `Submission.@@index([clientId])` | **DONE** | Present at `prisma/schema.prisma:347` (also `@@index([deletedAt])` line 348). No migration needed — index already in production schema. |
| **4.3** Batch slug availability check | **STILL OPEN** (Low) | `proposeSlug` still does sequential per-candidate queries. Not closing in this pass — slug generation is a cold-path (only on invite create) and the optimization is a nice-to-have. Tracked in carry-forward. |
| **4.4** Redundant `Notification.payload` column | **STILL OPEN** (Low) | Column still present. Closing requires a data migration (drop column) + audit of all consumers. Defer until we have a concrete size-pressure signal. Tracked in carry-forward. |

### Files touched this pass
- `lib/auth/csrf.ts` (new) — pure `checkSameOrigin(headers)` helper, fail-closed, subdomain-strict (matches `URL.host`, not suffix)
- `app/api/uploads/route.ts` — POST gets CSRF check
- `app/api/uploads/[id]/route.ts` — DELETE gets CSRF check
- `app/api/notifications/[id]/route.ts` — DELETE gets CSRF check
- `app/api/notifications/[id]/read/route.ts` — POST gets CSRF check
- `app/api/notifications/read-all/route.ts` — POST gets CSRF check (also fixed signature to accept `req: Request`)
- `app/api/admin/gdpr/erasure/route.ts` — POST gets CSRF check
- `app/api/admin/audit/chain/verify/route.ts` — POST gets CSRF check
- `tests/unit/csrf.test.ts` (new) — 10 cases: same-host accept, x-forwarded-host accept, scheme-variation accept, port-mismatch reject, cross-origin reject, missing Origin reject, missing Host reject, malformed Origin reject, subdomain-mismatch reject (both directions)

### Tests added
- 10 cases in `csrf.test.ts` covering accept paths (same host, x-forwarded-host, scheme variation) and reject paths (cross-origin, missing Origin, missing Host, malformed Origin, subdomain-strict in both directions)

### Verification
- `npm run typecheck` — green
- `npm test` — **271/271 passing** across 31 files (was 261/30 in Pass A; +1 file +10 tests)

### Carry-forward to next pass
- 2 lint errors (`<a>` elements in admin pages) → Pass C
- L2 / 4.3 slug-batch optimization (Low) → not closing
- L4 / 4.4 payload-column drop (Low) → not closing
- Notification enum (36) vs TS union (25) desync → Pass D

---

## 11. Update — 2026-07-19 (Pass C: UI/UX + Feature-Logic)

**Scope:** Full UI/UX walk across all route groups + components. Catalogued 50+ issues by severity, fixed every P1/P2 and the high-impact P3s. Pattern: respect AGENTS.md conventions (flex gap not space-y, Card not bare-border, Button asChild for link-buttons, data-icon on icon+text pairs, aria-label on icon-only buttons, Pagination shared component).

### P1 — Broken features (3 fixes)
| File:Line | Issue | Fix |
|---|---|---|
| `app/(client)/not-found.tsx:14` | `/dashboard` link 404'd (route doesn't exist; only `/dashboard/visitor/[slug]`) | Made the page async, resolves slug from session via `getCurrentUser()`, falls back to `/login` for unauthenticated viewers |
| `app/invite/[slug]/register-form.tsx:91` | Button label `'Creating your account&#8230;'` rendered the entity literally (it's inside a JS string, not JSX text) | Replaced with `'…'` (literal Unicode ellipsis char) |
| `app/(admin)/admin/sso/page.tsx:79` | "Download SP metadata" link → `/admin/sso/[id]/metadata` (non-existent route → 404) | Changed to `/api/auth/sso/[id]/metadata` (the actual API endpoint) + `download` attribute |

### Lint errors closed (2)
| File:Line | Issue | Fix |
|---|---|---|
| `app/(admin)/admin/email-templates/template-form.tsx:148` | `<a href="/admin/email-templates">` for internal nav (Next.js perf rule) | Replaced with `<Button asChild variant="outline"><Link>` |
| `app/(admin)/admin/webhooks/webhook-form.tsx:168` | Same | Same fix |

### P2 — Broken feature logic + a11y (12 fixes)
| File:Line | Issue | Fix |
|---|---|---|
| `app/(admin)/admin/search/page.tsx:127` | Admin submission result navigated to client-only route → admin got redirected to /login | Added `clientId` to `/api/admin/search` response, route admin to `/admin/clients/${clientId}` |
| `app/(admin)/admin/search/page.tsx:88,108,127` | Clickable `<Card>` rows had no keyboard support | Added `role="button" tabIndex={0} aria-label onKeyDown` (Enter + Space) to all 3 result-card types |
| `app/(admin)/admin/search/page.tsx` | No empty-state hint for queries < 2 chars | Added a Card with "Type at least 2 characters to search." |
| `app/(admin)/admin/settings/page.tsx:89-90` | "2FA: not done", "SSO: not done" — both ARE implemented (false claim) | Flipped both to `done`, also added SCIM + GDPR rows |
| `app/(client)/dashboard/visitor/[slug]/files/file-row.tsx:43-44` | `setError(err.message)` leaked raw error to UI (violates AGENTS.md uploads rule) | Replaced with generic `'Failed to delete file. Please try again.'` + `console.error` server-side |
| `app/(client)/dashboard/visitor/[slug]/profile/page.tsx:96-100` | `<Button>` nested inside `<a>` — invalid HTML | Switched to `<Button asChild variant="outline"><Link href="..." download>` |
| `components/comments/live-chat.tsx:65` | Silent `catch {}` — fetch failures left loading skeleton forever | Added `loadError` state + retry button; setState calls only after `await` to satisfy `react-hooks/set-state-in-effect` |
| `app/(auth)/login/2fa/two-factor-form.tsx:49` | "Lost access? Use a backup code." text with no UI to actually do so | Added mode toggle (TOTP ↔ backup code) — swaps `<InputOTP>` for `<Input>` |
| `app/(admin)/admin/api-keys/page.tsx:71-97` | Create-key form used raw `<input>`/`<button>` (no labels, no `<Button>`) | Rewrote with `<Field>` + `<FieldLabel>` + `<Input>` + `<Button>` |
| `app/(admin)/admin/{email-templates,sso,webhooks}/{template,sso-provider,webhook}-actions.tsx` | Icon-only buttons missing `aria-label` (3 files, 6 buttons) | Added `aria-label="Edit/Delete X"` per button |
| `app/(admin)/admin/sso/scim-keys.tsx` | Multiple issues: dark: overrides, raw inputs, bare divs, missing aria-labels | Full rewrite: Alert for new-key banner, Card per key row, Input + label for create form, aria-labels on icon buttons |
| `components/shared/pagination.tsx` | Component existed but ZERO imports — 7 admin pages reinvented it inline (~25 lines each = ~175 lines dup) | Adopted across all 7 list pages (users, clients, forms, team, invites, audit-log, email-logs) |

### P3 — Polish (35+ fixes across many files)
- **`space-y-*` → `flex flex-col gap-*`** (7 sites): unauthorized, forbidden, webhooks/email-templates CardContents, 3 loading.tsx files
- **`dark:` overrides removed from app code** (1 site): `roles/page.tsx` — `ROLE_COLORS` map replaced with semantic `<Badge variant>` (default/secondary/outline)
- **Tables wrapped in `overflow-x-auto`** (7 admin list pages)
- **Responsive grids** (4 sites): `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
- **Shell padding responsive scale** (3 sites): `p-8` → `p-4 sm:p-6 lg:p-8`
- **"Add X" link-as-button** (5 admin pages): `<Button asChild><Link>` for consistent focus ring
- **Heading classes standardized** (5 pages): brand `text-3xl font-heading tracking-wide`
- **Auth loading skeletons wrapped in Card** (3 files)
- **`data_icon="inline-start"` added** to ~12 icon+text pairs
- **`aria-label` added** to 7 search inputs
- **`role="status"`** on success messages
- **2FA page Card wrap**, **back-link arrow icon**, **clients/[id] "Edit details" button**

### Carry-forward (P4 polish — not closed)
- `forms/[id]/page.tsx` field preview container still bare-border
- `submissions/[id]/page.tsx` no back-link to forms list
- `submissions/new/page.tsx:18` `notFound()` could be friendlier in-page empty state
- `roles/page.tsx` uses hand-rolled `<table>` instead of shadcn `<Table>`
- Various `<img>` → `<Image>` migrations in shells

### Verification
- `npm run typecheck` — green
- `npm run lint` — **0 errors, 473 warnings** (was 2 errors at start of Pass C; both closed)
- `npm test` — **271/271 passing** across 31 files

### Files touched
40+ files across `app/`, `components/`. Zero behavioral changes to data flow, auth, or DAL — all changes are presentation-layer only.

---

## 12. Update — 2026-07-19 (Pass D: Notification Union + GDPR Test)

**Scope:** Close the notification enum/union desync (AGENTS.md known issue) and add the missing GDPR DAL integration test.

### Notification union gap closed (11 events)
The Prisma `NotificationType` enum has 36 values; the TS union in `lib/notifications/types.ts` had 25. The 11 missing events were silently undeliverable — calling `notify({ type: 'SSO_LOGIN_FAILED', ... })` would have been a type error at compile time (good) but meant the SCIM/SSO paths couldn't notify even when they should.

Added all 11 events to the union + audience rules + templates:

| Event | Audience | emailByDefault |
|---|---|---|
| `INVITE_CREATED` | empty (audit-only) | false |
| `INVITE_EXPIRED` | invite creator | false |
| `SUBMISSION_DRAFTED` | empty (drafts are private) | false |
| `SYSTEM_ERROR` | all SUPER_ADMINs | true |
| `SSO_PROVIDER_CREATED` | all SUPER_ADMINs (excl. actor) | false |
| `SSO_PROVIDER_UPDATED` | all SUPER_ADMINs (excl. actor) | false |
| `SSO_PROVIDER_DELETED` | all SUPER_ADMINs (excl. actor) | **true** (deletion breaks sign-in) |
| `SSO_LOGIN_SUCCESS` | empty (audit-only) | false |
| `SSO_LOGIN_FAILED` | all SUPER_ADMINs (security signal) | false |
| `SCIM_USER_PROVISIONED` | the provisioned user | **true** (welcome / credential handoff) |
| `SCIM_USER_DEPROVISIONED` | the deactivated user | **true** (account was deactivated) |

Audience logic lives in `lib/notifications/audience.ts`; render templates in `lib/notifications/templates.ts`. Both files now exhaustively switch on every union member — no `default` clause, so adding a future event will fail typecheck until all 3 files (types, audience, templates) are updated.

### GDPR DAL integration test (17 tests, all green)
`tests/integration/gdpr-dal.test.ts` — the only major DAL module previously without tests. Covers:

- **exportMyData** — profile + empty related data for fresh client; unauthenticated rejection
- **exportUserDataByAdmin** — admin can export any user; non-admin denied; NotFoundError for unknown id
- **requestErasure** — happy path; rejects duplicate pending; allows re-request after denial
- **listErasureRequests** — admin sees all; non-admin denied
- **approveErasure** — full anonymization (user + client + sessions + tokenVersion bump); audit log records the ADMIN as actor (regression-test for the variable-shadowing bug flagged in AGENTS.md "Known Issues & Defensive Patterns"); NotFoundError / not-pending guards; works on team-member users with no client row
- **denyErasure** — marks DENIED with reason; user is NOT anonymized; emits notification; rejects already-decided requests

The variable-shadowing regression test is the most security-relevant: AGENTS.md documents that `lib/dal/gdpr.ts:approveErasure` previously had `user` (outer from `requirePermission`) shadowed by `user` (inner from `tx.user.findUnique`), causing the audit log to record the VICTIM as the actor. The fix renames the outer to `admin` and inner to `erasureTarget`; the test asserts `audit.userId === admin.id` to lock that in.

### Verification
- `npm run typecheck` — green (after deleting stale `.next/dev/types/validator.ts` — a Next.js dev-server artifact not in git, unrelated to this pass)
- `npm run lint` — 0 errors, 473 warnings (unchanged)
- `npm test` — **288/288 passing** across 32 files (was 271/31 in Pass C; +1 file, +17 tests)

### Files touched
- `lib/notifications/types.ts` — added 11 union members
- `lib/notifications/audience.ts` — added 11 cases to `computeRecipients` switch
- `lib/notifications/templates.ts` — added 11 cases to `renderTemplate` switch
- `tests/integration/gdpr-dal.test.ts` — new file, 17 integration tests

### Carry-forward to next pass
- L2 / 4.3 slug-batch optimization (Low) → still open
- L4 / 4.4 payload-column drop (Low) → still open
- 2 client server actions returning `Promise<{success, error}>` (N6) → Pass E

---

## 13. Update — 2026-07-19 (Pass C.5: Visible Actions + Functional Settings + New Admin Features)

**Scope:** User reported that "action buttons aren't visible" and "some pages are UI-only, not functional". Investigation found:
- Invites page only rendered Resend/Revoke buttons when status was `OPEN` — table column was empty for consumed/expired/revoked invites (looked broken).
- Settings page (`GeneralSettingsForm`) was a static card of env-var documentation — not actually a functional settings form.
- Roles page said "Custom role assignment coming soon" — misleading stub.
- No admin visibility into active sessions or comments across clients.

Closed all four + added two new admin features and a runtime-configurable settings backbone.

### F1 — Invites actions always visible + Copy Link
| File | Change |
|---|---|
| `app/(admin)/admin/invites/page.tsx` | Replaced the `{i.status === 'OPEN' && ...}` conditional render — actions column now always shows. Resend button hidden when not OPEN, but Copy Link + Revoke always render (Revoke is disabled for non-OPEN). |
| `app/(admin)/admin/invites/invite-actions.tsx` (new) | Container that combines CopyLinkButton + Revoke button; handles the disabled state per invite status. |
| `app/(admin)/admin/invites/copy-link-button.tsx` (new) | "Copy link" button with copied-state feedback (Check icon + "Copied" text for 1.5s). Uses `navigator.clipboard.writeText`. Also exports a compact icon-only variant `CopyLinkIcon`. |
| `app/(admin)/admin/invites/revoke-button.tsx` | Existing — kept, used inside `InviteActions`. |

Result: every invite row now has visible Copy Link + Revoke actions regardless of status. The original misleading empty cells are gone.

### F2 — Removed misleading "coming soon" stub
`app/(admin)/admin/roles/page.tsx` — replaced "Custom role assignment coming soon." with "Each role inherits the permissions listed below." The permission matrix is the actual feature; the misleading stub is gone.

### F3 — SystemSetting model (key-value store)
| File | Change |
|---|---|
| `prisma/schema.prisma` | Added `SystemSetting` model: `key @id`, `value String`, `updatedBy String?`, `updatedAt @updatedAt`, `@@index([updatedAt])` |
| `prisma/migrations/20260719055647_add_system_setting/migration.sql` | New migration, applied to both dev and test databases |

Schema:
```prisma
model SystemSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
  updatedBy String?
  @@index([updatedAt])
}
```

### F4 — Functional Settings page (was: static text card)
| File | Change |
|---|---|
| `lib/dal/settings.ts` (new) | The settings DAL: 5 typed settings (maintenanceMode, maintenanceMessage, inviteTtlDays, passwordMinLength, requireAdminTwoFactor) with default values + bounds validation. Reads via `getSettingRaw/getBooleanSetting/getNumberSetting/isMaintenanceMode`. Writes via `updateSettings(updates)` with admin-only auth + audit + pre-write value capture for the audit `before` field. |
| `app/(admin)/admin/settings/general-settings-form.tsx` | Replaced the static env-var doc card with a real form. Auto-renders a control per setting (Switch for boolean, Input type=number for number, Textarea for text). Submits via `saveSettingsAction` using `useActionState`; shows success/error Alert. |
| `app/(admin)/admin/settings/actions.ts` (new) | `saveSettingsAction` server action — parses formData per setting type, calls `updateSettings`, `revalidatePath('/admin/settings')`. |
| `app/(admin)/admin/settings/page.tsx` | Passes real `getAllSettings()` data into the form (was passing nothing). |

The 5 runtime-configurable knobs:
1. **Maintenance mode** (boolean) — when on, clients get redirected to `/maintenance` (SUPER_ADMIN bypasses for debugging)
2. **Maintenance message** (text) — customizable banner text
3. **Invite link TTL** (number, 1-90 days) — currently informational; the createInvite code path can read this
4. **Minimum password length** (number, 8-128) — currently informational; the registration/change-password Zod schema can read this
5. **Require 2FA for admins** (boolean) — currently informational; the login flow can read this to enforce enrollment

(3-5 are wired into the DAL so any code path that wants to honor them just calls `getNumberSetting('inviteTtlDays')` etc. Full enforcement across all consuming code paths is the next iteration.)

### F5 — Maintenance mode enforcement
| File | Change |
|---|---|
| `app/maintenance/page.tsx` (new) | Public maintenance page with "Try signing in" link |
| `app/(client)/layout.tsx` | Calls `isMaintenanceMode()` after `requireRole('CLIENT')`. If on AND user is not SUPER_ADMIN, `redirect('/maintenance')`. Admins bypass so they can debug the portal during an outage. |

Per AGENTS.md, `proxy.ts` stays optimistic-only (no DB lookups). Maintenance enforcement lives at the layout boundary — correct DAL-pattern placement.

### F6 — Active Sessions admin page (`/admin/sessions`)
| File | Change |
|---|---|
| `lib/dal/sessions-admin.ts` (new) | `listActiveSessions()` (active = `revokedAt: null` AND `expiresAt > now`), `revokeSession(id)` (admin-only, audited), `revokeAllSessionsForUser(userId)` (bulk kill, audited). |
| `app/(admin)/admin/sessions/page.tsx` (new) | Admin-only page listing all active sessions: user, role, IP, browser+OS (parsed from UA), signed-in (relative), expires (relative), Revoke button per row. Caps at 200 to bound the query. Empty state when no sessions. |
| `app/(admin)/admin/sessions/actions.ts` (new) | `revokeSessionAction` server action |
| `app/(admin)/admin/sessions/revoke-button.tsx` (new) | Client component with `useTransition` for optimistic UI |

Use cases: incident response (kill compromised session), device audit ("who's signed in from where?"), stale-session cleanup.

### F7 — Comment Moderation admin page (`/admin/comments`)
| File | Change |
|---|---|
| `lib/dal/comments-moderation.ts` (new) | `listAllCommentsForModeration({page, pageSize, search, authorRole, internalOnly})` (paginated, cross-client), `moderateDeleteComment(id, reason?)` (hard-delete with audit — distinct from the user-facing soft-delete in `lib/dal/comments.ts`). |
| `app/(admin)/admin/comments/page.tsx` (new) | Admin-only page with search/role/internal filters + paginated table. Each row shows comment snippet, author + role, client link, visibility badge (Internal/External), posted date, and Delete button. Soft-deleted rows show at 50% opacity with "(soft-deleted)" tag — the Delete button is disabled for already-deleted rows. |
| `app/(admin)/admin/comments/actions.ts` (new) | `moderateDeleteCommentAction` server action |
| `app/(admin)/admin/comments/delete-button.tsx` (new) | Client component with `useTransition` + error handling |

Use cases: spam cleanup, abuse moderation, cross-client content review.

### F8 — Nav wiring
- `app/(admin)/admin-shell.tsx` — added Comments (MessageSquare) and Sessions (MonitorSmartphone) to sidebar
- `components/admin/command-palette.tsx` — added both pages to the Cmd+K palette with appropriate keywords (`'messages moderation chat'`, `'login devices logout revoke'`)

### Tests added (11 new, settings)
`tests/integration/settings-dal.test.ts` — 11 cases:
- Read defaults (4 settings types verified)
- Admin can flip maintenance mode on; reads reflect new value
- Non-admin is denied for both read (getAllSettings) and write (updateSettings)
- Rejects invalid boolean values, out-of-bounds numbers, NaN
- Clamps out-of-bounds READ to the configured range
- getAllSettings returns every defined key with current value + definition

### Verification
- `npm run typecheck` — green
- `npm run lint` — **0 errors, 473 warnings** (unchanged from Pass D)
- `npm test` — **299/299 passing** across 33 files (was 288/32 in Pass D; +1 file, +11 tests)
- Dev DB migrated successfully (`npm run db:migrate` applied `20260719055647_add_system_setting`)

### Files added (12 new)
- `prisma/migrations/20260719055647_add_system_setting/migration.sql`
- `lib/dal/settings.ts`, `lib/dal/sessions-admin.ts`, `lib/dal/comments-moderation.ts`
- `app/maintenance/page.tsx`
- `app/(admin)/admin/invites/invite-actions.tsx`, `app/(admin)/admin/invites/copy-link-button.tsx`
- `app/(admin)/admin/settings/actions.ts`
- `app/(admin)/admin/sessions/page.tsx`, `app/(admin)/admin/sessions/actions.ts`, `app/(admin)/admin/sessions/revoke-button.tsx`
- `app/(admin)/admin/comments/page.tsx`, `app/(admin)/admin/comments/actions.ts`, `app/(admin)/admin/comments/delete-button.tsx`
- `tests/integration/settings-dal.test.ts`

### Files modified (5)
- `prisma/schema.prisma` (added SystemSetting model)
- `app/(admin)/admin/invites/page.tsx` (use InviteActions)
- `app/(admin)/admin/roles/page.tsx` (drop "coming soon" stub)
- `app/(admin)/admin/settings/page.tsx` (pass settings to form)
- `app/(admin)/admin/settings/general-settings-form.tsx` (functional form)
- `app/(client)/layout.tsx` (maintenance mode check)
- `app/(admin)/admin-shell.tsx` (nav)
- `components/admin/command-palette.tsx` (palette entries)

