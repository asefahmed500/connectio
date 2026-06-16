# ClientConnect — Performance & Completion Plan

**Priority:** CRITICAL first, then HIGH, then MEDIUM. Each tier stops when ROI falls below 2x.

---

## Tier 0: Blockers (must fix before production)

### 0.1 Fix N+1 in `listActiveFormsForClient` (C2)
- **File:** `lib/dal/forms.ts:80-86`
- **Change:** Replace `include: { submissions }` with `_count: { select: { submissions: { where: { clientId } } } }`
- **Impact:** Reduces DB data transfer by ~100x for clients with many forms
- **Risk:** None — same data, different aggregation

### 0.2 Fix `getTopClientsByActivity` full table scan (C3)
- **File:** `lib/dal/analytics.ts:188-198`
- **Change:** Move sort to Prisma `orderBy` + add `take`
- **Impact:** O(limit) instead of O(clients)
- **Risk:** None

### 0.3 Fix auth-check-before-fetch in `getSubmissionDTO` (C5)
- **File:** `lib/dal/submissions.ts:65-71`
- **Change:** Check `requireClientAccess` before `findUniqueOrThrow`
- **Impact:** Prevents information leak via timing
- **Risk:** None

### 0.4 Add pagination to list endpoints (C1)
- **Files:** `lib/dal/clients.ts`, `lib/dal/forms.ts`, `lib/dal/files.ts`, `lib/dal/submissions.ts`, `lib/dal/team.ts`
- **Change:** Add `{ cursor, limit }` params to all list functions; add `take: 20` defaults
- **Impact:** Constant memory usage regardless of data size
- **Risk:** UI needs to adapt to paginated data (page components)

---

## Tier 1: High Priority (production regression risk)

### 1.1 Fix SSE notification per-connection tracking (C4)
- **File:** `app/api/notifications/stream/route.ts`
- **Change:** Track `lastSeenCreatedAt` per connection; pass to `listNotificationsSince`
- **Impact:** Each poll now only fetches new notifications, not the full 8s window

### 1.2 Add `loading.tsx` skeletons to all route groups
- **Files:** `app/(admin)/loading.tsx`, `app/(client)/loading.tsx`, `app/(team)/loading.tsx`
- **Change:** Skeleton cards matching each dashboard layout
- **Impact:** Perceived performance improvement; no more blank white screens

### 1.3 Add `error.tsx` boundaries to all route groups
- **Files:** `app/(admin)/error.tsx`, `app/(client)/error.tsx`, `app/(team)/error.tsx`
- **Change:** Error card with "Try again" button
- **Impact:** Graceful recovery from transient DB failures

### 1.4 Add JSON size limit to form submissions
- **File:** `lib/dal/submissions.ts:95-107`, `lib/dal/submissions.ts:110-163`
- **Change:** `if (JSON.stringify(formData).length > 500_000) throw ValidationError`
- **Impact:** Prevents DB bloat from oversized submissions

### 1.5 Fix `getRecentActivity` result bias (H1)
- **File:** `lib/dal/analytics.ts:97-157`
- **Change:** Fetch proportional per category (e.g., 7 subs + 5 comments + 3 files = 15)
- **Impact:** More representative activity feed

---

## Tier 2: Missing Features (product completeness)

### 2.1 Implement password reset flow
- **Files:** New: `app/(auth)/reset-password/`, `lib/dal/password-reset.ts`
- **Features:** Forgot password form → email link → reset form → new password
- **Dependency:** Email milestone (stub acceptable for now)

### 2.2 Complete settings page
- **File:** `app/(admin)/admin/settings/page.tsx`
- **Features:** Toggle maintenance mode, configure email, view audit log

### 2.3 Add structured form editor
- **File:** `app/(admin)/admin/forms/form-editor.tsx`
- **Features:** Add/remove/reorder fields via UI instead of JSON textarea

---

## Tier 3: Security Hardening

### 3.1 Swap rate limiter to Upstash Redis (H3)
- **File:** `lib/ratelimit.ts`
- **Change:** Implement Redis-backed token bucket adapter (env vars already configured)
- **Impact:** Shared rate limits across instances; persistent across restarts

### 3.2 Add CSRF protection to mutation endpoints (H4)
- **Files:** All mutation API routes + server actions
- **Change:** Require `X-CSRF-Token` header (or Next.js built-in server action protection)
- **Note:** Next.js 16 server actions have built-in CSRF via `Next-Action` header — verify coverage

### 3.3 Move audit to transactional outbox (H6)
- **File:** `lib/audit.ts`
- **Change:** Write to outbox table in same transaction as business data; background worker flushes to AuditLog
- **Impact:** Guaranteed audit completeness; tamper-evident

### 3.4 Add integration tests for DAL
- **Files:** `tests/integration/` (new directory)
- **Scope:** `requireClientAccess`, `canTransition`, `updateStatus`, `postComment`, `notify`
- **Framework:** Vitest + Testcontainers (or Docker Postgres)

---

## Tier 4: Polish (nice to have)

### 4.1 Add Submission `@@index([clientId])`
- **File:** `prisma/schema.prisma`
- **Change:** `@@index([clientId])`
- **Impact:** Faster per-client submission listing

### 4.2 Optimize file upload to stream-first magic-byte check (M7)
- **File:** `app/api/uploads/route.ts`
- **Change:** Read first 512 bytes for validation, stream rest to storage
- **Impact:** ~50% memory reduction for large uploads

### 4.3 Batch slug availability check (L2)
- **File:** `lib/dal/invites.ts`
- **Change:** Single `findMany({ where: { slug: { in: candidates } } })` instead of 6 individual queries

### 4.4 Remove redundant `Notification.payload` (L4)
- **File:** `prisma/schema.prisma`
- **Change:** Drop `payload` column; all data is in typed columns

### 4.5 Add GitHub Actions CI workflow
- **File:** `.github/workflows/ci.yml`
- **Steps:** `npm run audit` (typecheck → lint → test) on every push

---

## Implementation Order

```
Phase 1: Tier 0 (blockers) → C2, C3, C5, C1
Phase 2: Tier 1 (high)     → C4, 1.2, 1.3, 1.4, 1.5
Phase 3: Tier 2 (features) → 2.1, 2.2, 2.3
Phase 4: Tier 4 (CI)       → 4.5
Phase 5: Tier 3 (security) → 3.1, 3.2, 3.3, 3.4
Phase 6: Tier 4 (polish)   → 4.1—4.4
```

**Start immediately with Phase 1.** Each phase should pass `npm run audit` before proceeding.

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pagination breaks existing UI | High | Low | Add page-level ScrollArea components; test with 100+ items |
| N+1 fix changes data shape | Low | Low | Same DTO output schema |
| Redis down for rate limiter | Low | High | Fallback to in-memory; alert on fail |
| Transactional outbox adds latency | Medium | Low | Async flush; <50ms overhead per mutation |
| Form schema editor UX regression | Medium | Medium | Keep JSON editor as fallback; add toggle |
