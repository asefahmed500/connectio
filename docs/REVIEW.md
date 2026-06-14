# Review — Senior Architect Pass

**Reviewer:** design author, second pass
**Date:** 2026-06-14
**Subject:** `docs/00` through `docs/14`
**Verdict:** **B-minus.** Solid foundation and coherent architecture, but missing entire categories a production system needs (NFRs, capacity, DR, testing, search, analytics, privacy). Several code samples have correctness bugs. Read this before implementation.

---

## 1. What's solid

These are genuinely production-grade and shouldn't be re-litigated:

- **DAL as the security boundary** (`03`). All Prisma access goes through `lib/dal/*` with `server-only`, React `cache()` memoization, and per-function `requireRole` / `requireClientAccess` guards. This is the canonical Next 16 pattern and it's applied consistently.
- **`proxy.ts` as optimistic-only**. The doc is explicit that real auth lives in the DAL. Many teams get this wrong; this design doesn't.
- **Refresh-token rotation + revocation table** (`02`). Stateless access tokens (fast) + DB-backed refresh tokens (revocable) is the right trade-off.
- **Single-tx registration** (`04`). Invite → User → Client → consume-invite all in one Prisma `$transaction`. No orphaned half-accounts on crash.
- **Notification audience rules in one function** (`14`). `computeRecipients()` is the only place routing lives, and the security invariant ("internal never reaches client") is testable in isolation.
- **Storage adapter abstraction** (`07`). Local in dev, S3-compatible in prod, behind one interface. Lets us swap Vercel Blob/R2 without touching handlers.
- **Pre-rendered notification strings** (`14`). Frozen text avoids the "undefined mentioned you on undefined" problem when names change later.
- **Two-phase migration policy** (`01`). Destructive schema changes get a backward-compat phase. Many teams learn this the hard way.
- **Cookie hygiene** (`02`, `10`). HttpOnly + Secure + SameSite=Lax, `__Host-` prefix recommended for prod, no cookie writes in render path.

## 2. Critical gaps — missing categories

These are not details; they are entire docs that should exist and don't.

### 2.1 Non-functional requirements (NFRs) — **MISSING**

There is no doc that says:
- Target P95 latency for page render, API route, DB query.
- Availability SLO (99.5%? 99.9%? 99.95%?).
- Throughput targets (peak QPS, peak concurrent users).
- Consistency model (eventual? read-after-write?).
- Data freshness SLA (how stale can the admin dashboard be?).

Without NFRs, every scaling decision in the existing docs is arbitrary. "Vercel Fluid Compute handles thousands of SSE connections" (`14`) — based on what target? "Rate limit 300/min/user" (`10`) — for what load? **Add `15-non-functional-requirements.md`.**

### 2.2 Capacity & cost — **MISSING**

No analysis of:
- Expected user/client/submission/file counts at 1/3/12 months.
- Storage growth rate (drive by file uploads).
- Postgres row counts and query plans at scale.
- Monthly cost at 100 / 1k / 10k clients on Vercel + Neon + S3 + Upstash + SMTP.

The PRD says "production-ready" without saying *for how many users*. **Add `16-capacity-and-cost.md`.** Drive the choice of PgBouncer pooled connections, materialized views, and queue depth from real numbers.

### 2.3 Disaster recovery & business continuity — **PARTIAL**

`13-deployment.md` mentions Neon PITR (7-day free / 30-day scale) and Vercel atomic deploys. That's it. Missing:
- **RTO / RPO targets.** (Recovery Time / Recovery Point objectives.)
- **Restore drills.** When did we last restore from a Neon backup and verify it boots?
- **Multi-region or multi-provider fallback.** If `us-east-1` (Vercel's default) is down, what's the plan?
- **S3 cross-region replication.** If our bucket region is unavailable, can clients still download files?
- **Outage communication.** Status page, customer comms template.

**Add `17-disaster-recovery.md`.** Without it, "production-grade" is aspirational.

### 2.4 Testing strategy — **MISSING**

`package.json` has no test runner. No doc covers:
- Unit-test boundaries (DAL functions? Zod schemas? notification routing?).
- Integration tests (real Postgres via testcontainers or Neon ephemeral branch?).
- E2E tests (Playwright? which flows are covered?).
- The security invariant tests: internal comments never reach clients, IDOR tests, role-matrix tests.
- How tests get data (seeded fixtures vs migrations).
- Coverage target.

The notification audience function (`14` → `computeRecipients`) explicitly needs unit tests, but there's no test doc. **Add `18-testing-strategy.md`.**

### 2.5 Search — **MISSING**

`09-api-contracts.md` exposes `GET /api/admin/clients?q=` but no doc says how `q` is evaluated. Postgres `ILIKE`? Full-text search (`tsvector` + GIN)? A separate search engine (Meilisearch, Typesense, Algolia)? At 1k+ clients, ILIKE-on-every-query stops working. At 10k, even the index strategy matters. **Add `19-search.md`** or commit to ILIKE-with-an-index and document the ceiling.

### 2.6 Analytics — **MISSING**

PRD lists "Analytics Dashboard" as a feature. `09` exposes `GET /api/admin/dashboard`. But no doc says:
- Which queries power the dashboard (counts, groupBy, time-series).
- Whether they run live or against materialized views.
- Refresh frequency for materialized views.
- How to handle timezones ("submissions this month" — whose month?).
- Cardinality of `SubmissionStatus` groupBy at scale.

At a few hundred submissions this is fine; at 100k it's a 5-second page load. **Add `20-analytics.md`.**

### 2.7 Privacy / GDPR / PII — **MISSING**

For a portal holding client business data, this is non-negotiable and currently absent:
- **PII inventory.** Which fields are PII? (Email, contactName, projectName in formData, file contents, IP/UA in audit log.)
- **Data subject rights flow.** How does a user request export? Erasure? Correction?
- **Right-to-be-forgotten interaction with audit log.** GDPR says erase; auditors say keep. Documented reconciliation?
- **Data processing agreements** with Vercel, Neon, S3, Upstash, SMTP provider.
- **Data residency.** EU clients → EU infra? Currently single-region.
- **Cookie consent.** Strictly necessary only? Or analytics cookies (then need consent banner)?

**Add `21-privacy-and-compliance.md`.** Without it, the app cannot be sold to most enterprise clients.

### 2.8 Async job architecture — **PARTIAL**

`after()` (from `next/server`) is used throughout for fire-and-forget side effects (audit log, email, notification publish). But `after()` runs in the same request lifecycle and **dies if the function instance is recycled**. There is no:
- Durable queue for email retries (the doc says "retried 3x with backoff" but doesn't say *what* does the retrying).
- Scheduled-job framework beyond Vercel Cron (3 crons defined; what about digest emails? orphan cleanup is mentioned but the storage-vs-DB reconciliation logic isn't designed).
- Dead-letter queue for failed notifications.

For Phase 1 volumes, `after()` is fine. For anything real, this needs QStash or a worker. **Add `22-async-jobs.md`** with the threshold for upgrading.

## 3. Significant issues in existing docs

These are correctness bugs or contradictions inside docs already written.

### 3.1 `03-rbac-and-data-isolation.md` — dead code that lies

`requireClientAccess()` for `TEAM_MEMBER` contains:

```ts
const assigned = await prisma.teamAssignment.findUnique({
  where: {
    teamMemberId_clientId: {
      teamMemberId: claims.sub,  // NOTE: claims.sub is userId; lookup teamMember by userId first
      clientId,
    },
  },
}).catch(() => null)
// The composite key expects teamMemberId; resolve it:
const teamMember = await prisma.teamMember.findUnique({ where: { userId: claims.sub } })
```

The first query uses `userId` as `teamMemberId` — it will return null or the wrong row. The comment even admits it. This block should be deleted; only the second lookup is correct. A reader who copies this pattern introduces an authorization bug.

**Fix:** delete the dead first query.

### 3.2 `02-authentication.md` — refresh-token rotation race

Two concurrent requests with the same valid refresh token (common: SPA sends two API calls, both 401, both retry via `/api/auth/refresh`):

1. Request A reads session, validates, rotates.
2. Request B reads session (same one), validates, tries to rotate — but it's already revoked.

The current implementation: A succeeds, B fails with 401, user gets logged out.

**Fix:** detect reuse of a revoked token (a stolen-token signal — OAuth working draft treats this as a session-hijack indicator and revokes the entire family). At minimum, make rotation idempotent within a short window (e.g., return the same new token if the old one was revoked within the last 30 seconds).

### 3.3 `02-authentication.md` — role-change propagation is hand-wavy

Threat model says "short-lived (24h). Force re-login after role change." But there is no mechanism for "force re-login." If an admin demotes a Team Member to a Client, that user keeps their old role in their JWT for up to 24 hours.

**Fix:** add a `User.tokenVersion: Int` field. Embed it in the access token. Bump it on role change. DAL rejects tokens with stale versions. Cheap, solves it properly.

### 3.4 `05-forms-and-submissions.md` — `@@unique` destroys history

"Re-submitting replaces the row" via upsert on `(clientId, formId)`. If a client submits, gets `CHANGES_REQUESTED`, edits and re-submits, the original `formData` is gone. There is no way to see what changed.

**Fix:** add a `SubmissionRevision` table. On every mutation, write the previous `formData` to a revision row. Or remove the `@@unique` constraint and treat submissions as append-only (with status transitions only on the latest).

### 3.5 `07-uploads.md` — storage delete is not transactionally safe

"the DAL **must** also delete the underlying storage object before the row delete. Enforced by a `beforeDelete` Prisma extension."

Problems:
- Prisma's `$transaction` doesn't span external services. If the S3 delete succeeds and the DB delete then fails, the file is gone but the row remains → broken download links.
- `beforeDelete` extension runs *before* the DB delete, so if the DB delete fails afterward, same problem.

**Fix:** invert it. Soft-mark the row as `pendingDeletion`, *then* delete storage, *then* delete row. A cleanup cron reconciles rows marked `pendingDeletion` for >1hr. Idempotent and recoverable.

### 3.6 `14-notifications.md` — SSE scale claim is optimistic

"an instance can serve thousands of long-lived SSE connections." Vercel's Fluid Compute has actual concurrency limits per instance (around 1000 concurrent requests in practice, lower for streaming). With SSE, each connection holds a request slot. At 10k concurrent notification streams, you need ≥10 instances always warm — cost adds up fast.

**Fix:** reframe as "SSE for v1; budget for Pusher/Ably migration at ~500 concurrent streams." Add the cost line to `16-capacity-and-cost.md` (which doesn't exist yet — see §2.2).

### 3.7 `14-notifications.md` — email dedupe is N+1

```ts
for (const r of recipients) {
  const recent = await prisma.notification.findFirst({ ... })
  // ...
}
```

One DB round-trip per recipient. For an admin broadcast to 50 team members, that's 50 queries inside `after()`.

**Fix:** single `findMany` with `recipientId: { in: [...] }` and group in memory.

### 3.8 `10-security.md` — CSP `'unsafe-inline'` for scripts

Acceptable in v1 but the doc says "consider nonces later" without committing to a timeline. `'unsafe-inline'` for scripts defeats most of CSP's XSS value. Either commit to nonces from day 1 (it's ~30 lines in `proxy.ts` + `next.config.ts`) or accept the risk explicitly.

**Fix:** either implement nonces now, or add a hard deadline ("by feature-flag rollout to >5 clients").

### 3.9 `03-rbac-and-data-isolation.md` — concurrent edits unaddressed

Two team members edit the same submission simultaneously. Last write wins, no conflict detection. The user just sees their changes silently revert when the other person's save lands later.

**Fix:** add an `updatedAt` optimistic-concurrency token to mutation inputs. Server rejects writes where the input token doesn't match the current row. Standard pattern, missing.

### 3.10 `08-routing-and-ui-layout.md` — `requireClientAccessBySlug` is referenced but undefined

The `(client)` layout calls it, but `03` only defines `requireClientAccess(clientId)`. Either add the by-slug variant to `03` or change the layout to look up `clientId` from the slug first.

### 3.11 `02-authentication.md` — missing rate limit and CSRF on `/api/auth/refresh`

Anyone with a refresh token can hammer this endpoint. And it's a POST that accepts cookies — Origin check is missing. Both gaps.

### 3.12 `01-data-model.md` — `formData` JSON has no GIN index

If we ever want to query submissions by field value (admin analytics: "show all submissions where budget > 50k"), we need a GIN index on a `tsvector` or jsonb path expression. Not declared. Defer until needed, but call it out.

## 4. Under-specified trade-offs

Decisions that were made implicitly; senior review should expose them.

| Decision | Made how? | Should be |
|----------|-----------|-----------|
| Offset vs cursor pagination for `/api/admin/clients` | Implicit offset (page/limit) | Commit to cursor past 1k rows; document |
| Read-after-write consistency on dashboard | Implicit (revalidatePath) | State that admin dashboard is read-after-write; client dashboard is eventually consistent via tag invalidation |
| Notification email timing | "after() fires immediately" | Define a batching window (e.g. 30s) to avoid 10 emails when someone posts 10 comments in a row |
| File scan for malware | "deferred" | State the risk: unscanned files are downloaded by clients. Recommend ClamAV lambda before any production client onboarding |
| Form versioning UX | "create new Form row" | Define what happens to in-progress client submissions when an old Form is deactivated |
| `Date` serialization across RSC | Mentioned in 08 | Encode as lint rule: ban `Date` props on `'use client'` components |
| Audit log retention | Not specified | "Indefinite" or "7 years" or "180 days" — pick one |

## 5. Minor / polish

- `00-overview.md` and `13-deployment.md` repeat the topology diagram. Pick one home.
- `09-api-contracts.md` doesn't list `GET /api/notifications` or the notification-mark-read endpoints. They're in `14` but missing from the central API table.
- `12-env-and-config.md` lists `NEXT_PUBLIC_APP_URL` in two tables. Consolidate.
- Several docs end with "Open questions" — fine, but should roll up into a single backlog somewhere (issue tracker link, or `docs/OPEN-QUESTIONS.md`).
- `13-deployment.md` mentions `vercel.json` cron config and `next.config.ts` headers config but neither file actually exists in the repo yet. Flag as implementation TODO.
- No favicon, `robots.txt`, `security.txt`, or `manifest.json` mentioned. Minor but production-apparent.
- No mention of TypeScript `noUncheckedIndexedAccess` or other strict tsconfig hardening beyond `strict: true`.

## 6. Recommendations — ordered by impact

If you implement these in order, you remove the biggest risks first.

1. **Write `15-non-functional-requirements.md`.** Latency, availability, throughput, consistency. Two pages. Without this, no other scaling decision is grounded.
2. **Write `21-privacy-and-compliance.md`.** PII inventory, data subject rights flow, audit-log-vs-erasure reconciliation, DPAs. This blocks enterprise sales conversations.
3. **Fix the bugs in §3.** Especially 3.1 (authz dead code), 3.2 (refresh race), 3.3 (token version), 3.4 (submission history), 3.5 (storage delete). These will bite during implementation regardless of which feature goes first.
4. **Write `18-testing-strategy.md`.** Pick the test runner (Vitest for unit/integration, Playwright for E2E). Define the security-invariant suite. Wire CI.
5. **Write `16-capacity-and-cost.md`.** Real numbers from PRD projections. Drives the PgBouncer / materialized-view / queue decisions.
6. **Write `17-disaster-recovery.md`.** RTO/RPO, restore drill cadence, multi-AZ or multi-region story for the database.
7. **Write `20-analytics.md`.** Decide materialized views vs live queries. Define timezone handling.
8. **Write `19-search.md`.** Decide Postgres FTS vs dedicated engine and the migration trigger.
9. **Write `22-async-jobs.md`.** Pick QStash or a worker; define the threshold for migrating off `after()`.

## 7. What's right about the design (so we keep it)

So this review doesn't read as purely critical: the bones are good.

- The **DAL-first authorization** model is the right architecture and it's applied consistently.
- The **stateless JWT + revocable refresh** split is the right trade-off and well-explained.
- The **notification audience rules centralized in one function** is exactly the right encapsulation.
- The **App Router adaptation of a `pages/`-based PRD** is handled cleanly and the divergences are explicitly called out, not silently overridden.
- Every doc has an "Open questions" section, which is the right humble stance for a design at this stage.
- The **two-phase migration policy** and **cascade policy** in `01` show operational maturity.

This design will implement successfully. It just needs the missing categories filled in before it's "production-grade" in any sense an enterprise customer would accept.
