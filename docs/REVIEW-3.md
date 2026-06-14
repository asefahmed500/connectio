# Review 3 — Third-Pass Audit + Roadmap Synthesis

**Reviewer:** design author, third pass
**Date:** 2026-06-14
**Subject:** `docs/00`–`14`, plus `REVIEW.md` and `REVIEW-2.md`
**Verdict:** Still **B-minus**. This pass finds 12 *genuinely new* gaps the first two missed, but the returns are flattening. The bigger value of this doc is §3 — a single prioritized roadmap combining all three reviews — so we can stop reviewing and start building.

---

## 1. Diminishing returns — and why this is the last pass

`REVIEW.md` found 8 missing categories + 12 code bugs. `REVIEW-2.md` found 8 architectural smells + 12 process/rigor gaps + 10 cross-doc inconsistencies. A fourth pass would mostly split hairs.

This pass focuses on:
- Items genuinely missing from both prior reviews (§2).
- A consolidated roadmap (§3).
- A final grade with explicit reasoning (§4).

After this, the next senior-architect action is *implement* — not review.

## 2. New gaps neither prior review caught

### 2.1 No 2FA / MFA — and `SUPER_ADMIN` is the highest-privilege account

A Super Admin compromise = every client's data is exposed. There is no second factor. For a B2B product this is below the floor.

**Fix:**
- TOTP-based 2FA (RFC 6238) for `SUPER_ADMIN` accounts (mandatory, not optional).
- Optional 2FA for `TEAM_MEMBER` and `CLIENT`.
- Recovery codes generated at enrollment, hashed, stored.
- Add `User.twoFactorEnabled`, `User.twoFactorSecret` (encrypted at rest), `User.twoFactorBackupCodesHash[]`.
- Login flow gains a second step; remember-device cookie (30d) for UX.

Schema changes need to land in `01-data-model.md`. Out of scope in prior reviews because they focused on the existing schema, not what's missing from the threat model.

**Severity:** critical for any production launch.

### 2.2 No API tokens / Personal Access Tokens

Clients and team members will eventually want to pull their data programmatically ("push my submission into our CRM"). The current design has no PAT mechanism. They'll ask for it within 6 months of launch.

**Fix:** `ApiToken` model with `hashedToken`, `userId`, `scopes[]`, `lastUsedAt`, `expiresAt`. Route handlers accept `Authorization: Bearer <pat>` as an alternative to cookies. Tokens shown once at creation; subsequent reads see only the hash.

Without this, the integration story is "use the web UI or build a scraper." That's a competitive disadvantage.

### 2.3 No outbound webhooks

We *receive* webhooks (`/api/webhooks/email`). We don't *send* any. For an integration story, clients want to subscribe to events (`submission.submitted`, `comment.posted`) and have us POST to their endpoint. This is the same shape as Stripe/GitHub webhooks.

**Fix:** `WebhookEndpoint` model (per-user/org, URL + secret + event filter). On domain event (see `REVIEW-2.md` §2.2), publish to subscribed endpoints via the outbox, with HMAC signing, retries with exponential backoff, and a delivery log.

This is also the path to the Zapier/Slack integrations PRD lists as Phase 3 — they all reduce to outbound webhooks.

### 2.4 No bot protection on public forms

The invite registration page is a public form accepting an email + password. There is no CAPTCHA, no honeypot, no rate limit specifically tuned for bot signups (the existing rate limit is per-IP, easily defeated by a botnet).

**Fix:** Cloudflare Turnstile (privacy-respecting CAPTCHA alternative) on `/invite/[slug]` and `/login`. Server verifies the token. Adds a field to the existing forms. ~2 hours of work.

### 2.5 No DB-level concurrency strategy beyond optimistic locking

`REVIEW-2.md` §3.9 called for optimistic concurrency tokens on mutations. What it didn't address:

- **Pessimistic locking** for read-modify-write sequences that can't tolerate retry (e.g. issuing sequential invoice numbers, if we ever add billing).
- **Isolation level** choice. Prisma defaults to READ COMMITTED. The refresh-token rotation race (`REVIEW.md` §3.2) needs SERIALIZABLE or SELECT FOR UPDATE on the session row.
- **Unique-constraint races.** `Client.uniqueSlug @unique` plus the slug-proposal loop in `04-invites.md` — two concurrent admin requests for the same `contactName` will both propose the same slug, one wins the unique constraint, the other gets a Prisma P2002 error with no user-friendly handling.

**Fix:** document the concurrency model explicitly. Add a `docs/concurrency.md` covering: default isolation, when to use SELECT FOR UPDATE, when to use SERIALIZABLE, how unique-constraint races are surfaced to users (retry vs error).

### 2.6 No cache hierarchy design

The design mentions caches piecemeal:
- Next fetch cache (in `08`'s data patterns reference).
- `revalidatePath` / `revalidateTag` calls in actions.
- Browser HTTP cache (CSP, Cache-Control headers).
- Vercel CDN edge cache.

But there's no single doc that says: "for entity X, cache layer Y for duration Z, invalidate on event W." Result: each developer makes ad-hoc choices, and we get both cache leaks (stale data shown to user) and cache misses (DB hammered for the same data).

**Fix:** `docs/caching-strategy.md`. For each entity, list cache layer + TTL + invalidation trigger. The `next-cache-components` skill is already vendored; use it.

### 2.7 Soft references in JSON columns have no integrity

`Submission.formData` (JSON) may contain `file` field values that reference `File.storageKey`. `Notification.payload` references various IDs. None of these have FK constraints — they're just strings in JSON.

When a File is deleted (cascade), the `formData.file` value still references its storage key. Submission renders broken. Same for any JSON reference.

**Fix:** either (a) document and accept (with a reconciliation job), or (b) normalize — pull file references into a `SubmissionFile` join table with real FKs. Option (b) is more work but pays off the first time a client wonders why their submission shows a missing image.

### 2.8 Streaming uploads hold a DB connection for the upload duration

`07-uploads.md` Strategy A streams the file from browser → Next route handler → S3, then creates the DB row. During the upload (could be 50MB on a slow link, 30+ seconds), the function instance is busy. With many concurrent uploads, this exhausts function concurrency fast.

The DB connection isn't *held* the whole time (we only write at the end), but the function instance is. On Vercel, function concurrency is the bottleneck.

**Fix:** for v1, document the upload size ceiling (50MB) and the concurrency implication. For scale, only Strategy B (presigned direct-to-S3) avoids this — the design mentions it but doesn't commit.

### 2.9 Path-based multi-tenancy locks out white-label

`/dashboard/visitor/[slug]` is path-based. Some clients (especially agencies using this for their *own* clients) want `acme.clientconnect.com` or `portal.acme.com`. Retrofitting subdomain multi-tenancy means re-doing routing, the slug → clientId lookup (now via hostname), and TLS certificate management.

**Fix:** even if v1 is path-based, decide explicitly: is subdomain multi-tenancy a v2 commitment or a never? Document the choice. If yes, add an `app/[tenant]/...` route group structure ready to switch. If never, write that down so future teams stop asking.

### 2.10 Email deliverability is treated as setup, not program

`12-env-and-config.md` lists SMTP creds. `13-deployment.md` says "configure SPF/DKIM/DMARC." That's a one-time setup checkbox. Real email deliverability is an ongoing program: monitor sender reputation (Google Postmaster Tools), handle bounces (suppression list), process complaints (ESP feedback loops), rotate DKIM keys annually, watch blocklists.

**Fix:** add `docs/email-deliverability.md`. Define: bounce handling, suppression list, complaint processing, DKIM rotation cadence, monitoring. Without this, 20% of notification emails silently land in spam by month 3.

### 2.11 No first-admin onboarding wizard

The deploy runbook in `13-deployment.md` says "Run the admin seed once (or create the first admin via SQL)." That's a developer operation, not a user-facing flow. The first non-technical operator who installs this has no way to bootstrap a Super Admin without DB access.

**Fix:** either (a) document that this app requires a developer to deploy (acceptable for self-hosted), or (b) build an install wizard: first request to `/` after deploy with empty User table → setup wizard → creates first SUPER_ADMIN → marks install complete. Standard pattern (WordPress, GitLab, Sentry self-hosted).

### 2.12 No bulk operations

Admin eventually needs to:
- Bulk-assign team members to N clients.
- Bulk-export all client submissions as a zip.
- Bulk-archive old clients.
- Bulk-revoke expired invites (cleanup button vs cron).

The design has per-resource endpoints only. Bulk ops need: a different API shape (job-based, not synchronous), permission model (admin-only), and progress reporting.

**Fix:** defer to v2 but acknowledge. Adding bulk operations to a synchronous action-based system requires a job framework (see `REVIEW.md` §2.8 async jobs).

---

## 3. Synthesized roadmap — all three reviews, prioritized

Everything from `REVIEW.md`, `REVIEW-2.md`, and `REVIEW-3.md`, merged and ordered by:

1. **Blocks production launch** (security, correctness, compliance)
2. **Blocks scaling past MVP** (architectural)
3. **Quality of life** (process, rigor)

### Tier 0 — must land before any production user

| # | Item | Source | Effort |
|---|------|--------|--------|
| 0.1 | Fix the 12 code bugs from `REVIEW.md` §3 | R1 | 1 day |
| 0.2 | Add 2FA/MFA for SUPER_ADMIN (§2.1 above) | R3 | 2 days |
| 0.3 | Add CAPTCHA on public forms (§2.4) | R3 | 2 hours |
| 0.4 | Add idempotency keys on mutations (`REVIEW-2.md` §2.4) | R2 | 1 day |
| 0.5 | Transactional outbox for audit + notifications (`REVIEW-2.md` §2.3) | R2 | 2 days |
| 0.6 | Write `15-non-functional-requirements.md` (R1 §2.1) — drives everything else | R1 | 1 day |
| 0.7 | Write `21-privacy-and-compliance.md` (R1 §2.7) — GDPR blocks enterprise | R1 | 2 days |
| 0.8 | Write `18-testing-strategy.md` (R1 §2.4) + wire Vitest + Playwright | R1 | 3 days |
| 0.9 | Refresh-token rotation race fix (`REVIEW.md` §3.2) + DB concurrency doc (§2.5 above) | R1+R3 | 1 day |

**Tier 0 total: ~13 working days.** Without these, "production-grade" is a lie.

### Tier 1 — must land before scaling past ~50 clients or 5 team members

| # | Item | Source | Effort |
|---|------|--------|--------|
| 1.1 | Domain layer with entities + invariants (`REVIEW-2.md` §2.1) | R2 | 5 days |
| 1.2 | Domain event bus (`REVIEW-2.md` §2.2) | R2 | 3 days |
| 1.3 | API tokens / PATs (§2.2 above) | R3 | 3 days |
| 1.4 | Outbound webhooks (§2.3) | R3 | 4 days |
| 1.5 | Write `16-capacity-and-cost.md` (R1 §2.2) — drives RLS, queue, materialized view decisions | R1 | 1 day |
| 1.6 | Write `17-disaster-recovery.md` (R1 §2.3) — RTO/RPO, restore drills | R1 | 2 days |
| 1.7 | Postgres RLS as defense-in-depth (`REVIEW-2.md` §2.5) | R2 | 3 days |
| 1.8 | ADRs (`REVIEW-2.md` §2.7) — at least 8 initial records | R2 | 1 day |
| 1.9 | SLO + error budget policy (`REVIEW-2.md` §3.1) | R2 | 2 days |
| 1.10 | Runbooks (`REVIEW-2.md` §3.2) — 6 initial | R2 | 2 days |
| 1.11 | Search architecture decision (`REVIEW.md` §2.5) — Postgres FTS vs Meilisearch | R1 | 2 days |
| 1.12 | Analytics architecture (`REVIEW.md` §2.6) — materialized views vs live | R1 | 3 days |

**Tier 1 total: ~32 working days.** This is "enterprise production-grade."

### Tier 2 — quality of life, ship incrementally

| # | Item | Source |
|---|------|--------|
| 2.1 | Bounded contexts in the DAL (`REVIEW-2.md` §2.8) | R2 |
| 2.2 | Feature flag architecture (`REVIEW-2.md` §2.6) | R2 |
| 2.3 | Async job architecture (`REVIEW.md` §2.8) — QStash or worker | R1 |
| 2.4 | Cache hierarchy doc (§2.6 above) | R3 |
| 2.5 | Email deliverability program (§2.10) | R3 |
| 2.6 | Accessibility doc + WCAG target (`REVIEW-2.md` §4.2) | R2 |
| 2.7 | i18n readiness — strings through `t()`, dates via Intl (`REVIEW-2.md` §4.3) | R2 |
| 2.8 | Source maps + client error reporting (`REVIEW-2.md` §4.4) | R2 |
| 2.9 | Bundle size budget (`REVIEW-2.md` §4.5) | R2 |
| 2.10 | Design system documentation (`REVIEW-2.md` §4.6) | R2 |
| 2.11 | Client state management decisions (`REVIEW-2.md` §4.1) | R2 |
| 2.12 | Load test plan (`REVIEW-2.md` §3.3) | R2 |
| 2.13 | CI/CD design (`REVIEW-2.md` §3.4) | R2 |
| 2.14 | Impersonation feature (`REVIEW-2.md` §3.5) | R2 |
| 2.15 | Onboarding wizard for first admin (§2.11) | R3 |
| 2.16 | Subdomain vs path multi-tenancy decision (§2.9) | R3 |
| 2.17 | Soft-ref reconciliation for JSON columns (§2.7) | R3 |
| 2.18 | Bulk operations framework (§2.12) | R3 |
| 2.19 | Concurrency model doc (§2.5) | R3 |
| 2.20 | Cross-doc consistency pass (`REVIEW-2.md` §5 — 10 drifts to fix) | R2 |

**Tier 2 total: ~30 working days, parallelizable.**

### Cumulative

- **Tier 0:** ~13 days — minimum to ship to one real client.
- **Tiers 0+1:** ~45 days — enterprise production-grade.
- **Tiers 0+1+2:** ~75 days — architect-signed-off.

Calibrated for one strong engineer with occasional review. Two engineers in parallel: roughly half the wall-clock.

## 4. Final grade — and why it's still B-minus

The grade isn't about the docs themselves (which are well-written and cover their chosen scope). It's about whether the **design as a whole** is production-grade. By that bar:

| Dimension | Grade | Why |
|-----------|-------|-----|
| Coverage of standard topics | B | Missing 8 categories (R1) |
| Correctness of code samples | B-minus | 12 bugs (R1) + JSON soft refs (R3) |
| Architectural depth | C-plus | Anemic domain model, no event bus, no outbox (R2) |
| Operational rigor | C | No SLO, runbooks, DR drills, load tests (R2 + R3) |
| Security posture | C | No 2FA, no CAPTCHA, no RLS, no idempotency (R2 + R3) |
| Compliance readiness | D | No GDPR doc, no PII inventory, no DPAs (R1) |
| Internal consistency | B | 10 cross-doc drifts (R2) |
| Adaptability (i18n, accessibility) | C-minus | Strings hardcoded, no a11y doc (R2) |

**Weighted aggregate: B-minus.** Same as the first review.

What's changed is *clarity*: the gap is no longer vague. It's a prioritized list of ~50 items across three tiers, and the critical-path items (Tier 0, 13 days) are unambiguous.

## 5. Recommendation — stop reviewing

A fourth pass would mostly restate these findings. The architecture is sufficiently audited. The next step is **decide which tier to target and start implementing**.

Concrete next moves, in order:

1. **Decide the target.** Is this an MVP for one pilot client (Tier 0 enough), or an enterprise-grade product from day one (Tiers 0+1)?
2. **If Tier 0:** start with item 0.6 (NFRs) and 0.1 (bug fixes) in parallel. NFRs inform whether 2FA, RLS, etc. are truly required for v1.
3. **If Tiers 0+1:** write NFRs first (0.6), then refactor for domain layer (1.1) and event bus (1.2) before adding more features. Adding features on the current procedural DAL will compound tech debt.
4. **Stop running /review.** The marginal value of a fourth pass is below the cost of writing it. Spend that effort on `15-non-functional-requirements.md` instead — it unblocks more decisions than another review would.

The architecture as documented is shippable, with caveats. The architecture as designed needs Tier 0 before it can be called production-grade with a straight face. Everything else is a roadmap, not a blocker.
