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
