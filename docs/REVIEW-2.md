# Review 2 — Second-Pass Architect Audit

**Reviewer:** design author, fresh-eyes second pass
**Date:** 2026-06-14
**Subject:** `docs/00`–`14`, plus `REVIEW.md` (first pass)
**Verdict:** Still **B-minus**, but the gap is different than the first review implied. First review caught missing categories and code bugs. This pass finds architectural smells the first review glossed over — the design is *procedurally* coherent but *conceptually* thin. It's a CRUD app with auth, not a domain-modeled system. For an MVP that's fine; for "production grade" at enterprise scale it isn't.

This pass assumes the first review's recommendations are accepted (NFRs, GDPR, testing docs will exist). It looks at what's still wrong *underneath* those.

---

## 1. Acknowledged from first pass — not repeated

- The 8 missing docs (NFRs, capacity, DR, testing, search, analytics, GDPR, async jobs).
- The 12 code-level bugs in `REVIEW.md` §3. None have been fixed in the design.

What follows is *new*.

## 2. Architectural smells (new)

These are not "missing docs"; they're wrong shapes in the existing design.

### 2.1 Anemic domain model — there is no domain, only data + procedures

The design has:
- `Submission` as a Prisma model with `status` and `formData`.
- `ALLOWED: Record<SubmissionStatus, SubmissionStatus[]>` constant in `lib/dal/submissions.ts` (per `05-forms-and-submissions.md`).
- `updateSubmissionStatus(id, next)` — a free function that mutates a row.

There is no `Submission` *entity* with behavior. State transitions, invariants, and rules live in DAL functions or in the action layer, scattered. A reader can't tell at a glance what a `Submission` *can do* — only what columns it has.

**Symptoms:**
- The transition map `ALLOWED` is a module-level constant. Where does the rule "only the assigned team can transition to APPROVED" live? Answer: nowhere yet — it's an "open question" hint in the doc.
- Where does the rule "re-submit after CHANGES_REQUESTED must include the fields the reviewer flagged" live? Nowhere.
- Setting `reviewedBy` and `reviewedAt` happens in a DAL function (`05`). If a second callsite ever transitions to APPROVED without going through that function, the invariant breaks. There's no protection.

**Fix:** introduce a thin domain layer.

```ts
// lib/domain/submission.ts
export class SubmissionEntity {
  private constructor(
    private readonly row: SubmissionRow,
    private readonly viewer: SessionUser,
  ) {}

  static forViewer(row: SubmissionRow, viewer: SessionUser) { return new SubmissionEntity(row, viewer) }

  canTransitionTo(next: SubmissionStatus): Result<void, TransitionError> {
    if (!ALLOWED[this.row.status].includes(next)) return err(new TransitionError(this.row.status, next))
    if (next === 'APPROVED' && !this.viewer.canReview) return err(new ForbiddenError())
    return ok()
  }

  transitionTo(next: SubmissionStatus): Result<SubmissionPatch, DomainError> {
    return this.canTransitionTo(next).map(() => ({
      status: next,
      reviewedAt: next === 'APPROVED' || next === 'REJECTED' ? new Date() : this.row.reviewedAt,
      reviewedBy: next === 'APPROVED' || next === 'REJECTED' ? this.viewer.userId : this.row.reviewedBy,
    }))
  }
}
```

DAL calls into the entity; the entity enforces invariants. Same shape for `Client`, `Invite`, `Comment`, `Form`. This is a real refactor of the design, not a doc addition.

**Severity:** medium-high. Without it, business rules accrete in actions and get duplicated/inconsistent over time.

### 2.2 No domain event bus — side effects are hardcoded in switch statements

`computeRecipients()` in `14-notifications.md` is a giant `switch (event.type)` that knows about every event type. Adding a new side effect (e.g. "when a submission is approved, kick off an onboarding workflow") means editing the action that triggered it. This couples producers to consumers.

What's missing:

```ts
// when SUBMISSION_APPROVED happens, N things listen:
bus.on('SUBMISSION_APPROVED', notifyRecipient)        // notifications
bus.on('SUBMISSION_APPROVED', appendToAuditLog)        // audit
bus.on('SUBMISSION_APPROVED', sendApprovalEmail)       // email
bus.on('SUBMISSION_APPROVED', triggerOnboardingFlow)   // future workflow
bus.on('SUBMISSION_APPROVED', invalidateAnalyticsCache)// analytics
```

Producers emit events; consumers subscribe. The current design has this *implicit* — `notify()` is called from the action, audit log is called from the action, email is called from inside `notify()` — but not *explicit*. Every new side effect will require touching the action.

**Fix:** introduce `lib/events/`. Producers `emit(event)`. Handlers register at boot via `instrumentation.ts`. For v1 this can be in-process (synchronous `after()` chain). For scale, swap in an outbox + queue without changing producer code.

**Severity:** medium. Fine for v1 if you commit to the migration before adding the 3rd side effect per event.

### 2.3 No outbox pattern — `after()` is not durable

`after()` runs after the response but **in the same function instance**. If Vercel recycles the instance (cold start, scale-down, deploy) between the response and the `after()` callback completing, the email/audit/notification is lost. The first review's §2.8 (async jobs) flagged this for *future* scale; this pass says it's a *correctness* problem now, not just a scale problem.

For events that must not be lost (audit log, notifications), use the **transactional outbox**:

```ts
await prisma.$transaction([
  prisma.submission.update(...),
  prisma.outboxEvent.create({
    data: { type: 'SUBMISSION_APPROVED', payload: {...}, status: 'PENDING' },
  }),
])

// separate worker reads PENDING events, delivers, marks DELIVERED
```

The DB write and the "thing to do later" commit atomically. A worker (Vercel Cron + QStash, or a dedicated worker) drains the outbox.

**Severity:** high for audit and notifications; medium for emails (user-visible but recoverable).

### 2.4 No idempotency on mutations

Server Actions and POST routes are not idempotent. Concrete failure modes:

- User double-clicks "Submit" — two `SUBMISSION_SUBMITTED` events fire; two notification broadcasts go out; audit log has duplicates.
- Client retries a failed upload — two `File` rows, two S3 objects (one orphaned).
- Network blip mid-request — client retries; same create runs twice.

**Fix:** require an `Idempotency-Key` header (or hidden form field) on every mutation. Server stores `(key, requestId, response)` in an `IdempotencyRecord` table with a 24h TTL. Same key → same response, no side effect re-executed.

Standard pattern (Stripe popularized it). Missing entirely.

**Severity:** high. Without it, duplicate submissions and double-charged business logic will happen in production.

### 2.5 No Row-Level Security as defense-in-depth

The design's data isolation is **application-layer only**. `requireClientAccess()` is the gate, but if a future DAL function forgets to call it, the query returns the row. There's no database-level backstop.

Postgres RLS would enforce "a session can only see rows where `clientId` matches their session" at the DB layer. Even if the application has a bug, RLS catches it.

**Fix:** enable RLS on `Submission`, `Comment`, `File`, `Notification`. Set the session's `clientId` via `SET LOCAL app.client_id = ?` at the start of each transaction. Policies:

```sql
CREATE POLICY client_isolation ON submissions
  USING (client_id = current_setting('app.client_id')::text);
```

The DAL still does its checks (defense-in-depth, plus DAL checks drive the UX). RLS is the floor.

**Severity:** medium. Doesn't block v1; should be on the security roadmap before any enterprise customer onboarding.

### 2.6 No feature flag architecture

`12-env-and-config.md` says "feature flags belong in a DB-backed table, not env vars." No such table is in the schema. No flag service is wired. The first mention of feature flagging is in `10-security.md` ("once we have time to test" CSP nonces), which implies *some* flag mechanism exists — but it doesn't.

**Fix:** add a `FeatureFlag` table (per-user, per-client, global). Wire a `isEnabled(flag, ctx)` helper in the DAL. Used by: CSP nonces rollout, notification emails (off until verified), form-builder UI (internal only), analytics dashboards. Without this, every "ship dark" decision becomes a deploy + code change.

**Severity:** low for v1, but compounds.

### 2.7 No ADRs — decisions without considered alternatives

Every doc has decision tables ("we picked jose not jsonwebtoken"). What's missing is the *considered alternatives* and the *context* that made us pick one. That's what an Architecture Decision Record (ADR) is for.

Without ADRs:
- A future engineer reads "we use jose" and has no idea why. They may "improve" it back to jsonwebtoken.
- A security reviewer can't tell whether a decision was deliberate or accidental.
- The team has no record of *what was rejected and why*, so the same debates recur.

**Fix:** create `docs/adr/` with one file per significant decision. Format: Context · Decision · Consequences · Considered Alternatives. Start with:

- `0001-app-router-over-pages.md`
- `0002-jose-over-jsonwebtoken.md`
- `0003-argon2id-over-bcrypt.md`
- `0004-shared-schema-multi-tenancy.md`
- `0005-stateless-jwt-plus-revocable-refresh.md`
- `0006-sse-over-websockets.md`
- `0007-dal-as-security-boundary.md`
- `0008-no-orm-database-transactions-for-side-effects-outbox.md` (once added)

**Severity:** medium. Doesn't affect code; affects whether the team can scale without rehashing old debates.

### 2.8 Bounded contexts not separated

`Submission`, `Client`, `Comment`, `Notification`, `AuditLog`, `File`, `Form` all live in one Prisma schema, in one `lib/dal/*` directory. There's no module boundary between them.

Symptoms:
- `notifications.ts` reaches into `clients`, `teamAssignments`, `users`, `comments`, `submissions`. Coupling everywhere.
- Adding a field to `User` risks touching DAL files that "shouldn't" care about User internals.

For 7 models this is fine. For 30+ (which the app will reach) it's spaghetti.

**Fix:** group DAL files by bounded context:

```
lib/dal/
├── identity/      # User, Session, Invite (registration & auth)
├── intake/        # Client, TeamMember, TeamAssignment
├── forms/         # Form, Submission
├── collaboration/ # Comment, File
├── engagement/    # Notification
└── ops/           # AuditLog, FeatureFlag, IdempotencyRecord
```

Cross-context imports go through a context's public interface (e.g. `identity.getUserSummary()`), not raw Prisma.

**Severity:** medium. Refactor before the 4th context exists.

## 3. Process / operational gaps (new)

These are what an architect would expect to see alongside the design itself, not in it.

### 3.1 No SLO / SLI hierarchy, no error budget policy

First review called for NFRs (`15-non-functional-requirements.md`). What it didn't say: NFRs need an *error budget* governance model. If availability SLO is 99.9% (43min/month error budget), what happens when we burn half of it in week 1? Who decides to freeze feature deploys? That's a process question, not a doc.

**Fix:** add a `docs/slo-and-error-budget.md` (or fold into `15`). Define:
- Per-service SLOs (web, API, DB, file downloads).
- SLIs that feed them.
- Error budget policy: "if budget < 25% remaining, only reliability work merges."
- Review cadence (monthly SLO review).

### 3.2 No runbooks

`11-error-handling-and-observability.md` mentions runbooks will "live in a separate ops wiki once we ship." That's a deferral, not a design. For an enterprise-grade system, the runbook *is* the design for incident response. Needed:

- `runbooks/incident-sev1-database-unavailable.md`
- `runbooks/incident-sev1-s3-outage.md`
- `runbooks/rotate-jwt-secret.md`
- `runbooks/force-logout-all-users.md`
- `runbooks/restore-from-neon-backup.md`
- `runbooks/handle-gdpr-erasure-request.md`

Each runbook: trigger conditions, severity, first 5 actions, escalation contacts, post-incident steps.

### 3.3 No load test plan

The design says "Vercel Fluid Compute handles N SSE connections" and "rate limit 300/min/user" — but there's no test that proves either. Production-grade systems have a load test that runs pre-launch and on every major change.

**Fix:** add `docs/load-testing.md`. Use k6. Cover:
- Concurrent SSE connections (target derived from `15-nfrs`).
- Sustained submission write rate.
- Admin dashboard query at 100k submissions.
- File upload throughput.

### 3.4 No CI/CD design beyond a one-liner

`13-deployment.md` shows a CI YAML with lint + typecheck + build. That's the floor. Missing:
- Branch protection rules (require review, require status checks).
- Merge queue.
- Required reviewers per area (security-sensitive paths require security review).
- Staged rollout (canary to 5% → 25% → 100% over 30 min).
- Rollback procedure (Vercel's instant rollback — but what about DB migrations?).
- Database migration review gate (destructive migrations require sign-off).

### 3.5 No impersonation / "view as" capability — and no audit for it

When a client reports "I can't see X," the support path is: an admin impersonates the client to see what they see. The design has no impersonation feature. For B2B SaaS, this is expected.

Adding it later requires: a `User.impersonatingUserId` field, an `AuditLog` action `IMPERSONATION_STARTED` / `ENDED`, a banner UI ("You are viewing as Jane Doe · Exit"), and a strict policy (only `SUPER_ADMIN`, every impersonation audited, time-boxed).

**Severity:** medium for v1; high for any paid customer base.

## 4. Engineering rigor gaps (new)

### 4.1 Client state management undefined

The design says "Server Actions for mutations, Server Components for reads" but never says how a client-side list (e.g. comments thread) updates optimistically after a post. With `useActionState`, the form state updates but the *list* doesn't — the page revalidates via `revalidatePath`, which discards scroll position and pending state.

**Fix:** pick one of:
- **`revalidatePath` only** — accept the flash. Fine for low-frequency mutations.
- **Optimistic via `useOptimistic`** (React 19) — show the new comment immediately, reconcile on action completion.
- **SWR/React Query for client-managed lists** — bypass RSC for high-interactivity surfaces.

The design needs to say which surfaces use which. Right now it's "Server Actions everywhere," which works for v1 but breaks on the comments thread.

### 4.2 Accessibility undefined

No doc mentions WCAG target (2.1 AA? 2.2 AA?), keyboard navigation, screen reader support, focus management on route transitions, color contrast in the shadcn theme.

shadcn/ui gives you 80% for free, but the other 20% (focus traps in modals, ARIA on the notification bell, live regions for the unread count, alt text requirements on uploaded files) requires explicit design.

**Fix:** add `docs/accessibility.md`. Define WCAG 2.1 AA as the floor, list the components needing audit, and add `@axe-core/playwright` to the E2E suite (which doesn't exist yet — see first review §2.4).

### 4.3 i18n readiness — even though v1 is English-only

The design says "English only for v1" and defers `app/[locale]/...`. But i18n retrofit is expensive: dates, numbers, currency, pluralization, gender, RTL all need to be considered early. Strings hardcoded in components are the worst offender.

**Fix:** even if v1 ships English-only:
- All UI strings go through a `t('key')` helper that's a passthrough today.
- Dates use `Intl.DateTimeFormat` with locale derived from `User.locale` (add the column).
- Currency use `Intl.NumberFormat`.
- The `<html lang>` attribute is parameterized.

This is ~1 day of work now, or 2 weeks when the first non-English customer arrives.

### 4.4 Source maps and client error reporting

`11-error-handling-and-observability.md` covers server errors. Client errors (a crash in a Client Component) are unaddressed: no source maps uploaded to Sentry, no `window.onerror` handler, no global ErrorBoundary in `app/layout.tsx`.

**Fix:** add Sentry browser integration. Upload source maps on build. Add a top-level `<ErrorBoundary>` client component wrapping `{children}` in the root layout.

### 4.5 Bundle size budget

Next 16 + React 19 + Prisma client + shadcn + jose + argon2 + zod + lucide-react + the full shadcn kit — bundle size can balloon. No budget enforced.

**Fix:** add `bundle-analyzer` to `next.config.ts`. Set a budget (initial JS < 200KB gzipped for the marketing pages, < 350KB for authenticated pages). CI fails the build if exceeded.

### 4.6 No design system documentation

shadcn components live in `components/ui/`. There's no documentation of: which components are used where, what variants are allowed, what the spacing system is, what the color palette means (the `oklch` variables in `globals.css`).

For a team >1 person, this matters. Add a Storybook (or simple MDX) with one example per component, and a `docs/design-system.md` linking to it.

## 5. Cross-doc inconsistencies (new)

The first review noted one (env var table duplication). Here are more.

| Issue | Where |
|-------|-------|
| `09-api-contracts.md` doesn't list notification endpoints | `14` defines `GET /api/notifications`, `POST /api/notifications/[id]/read`, etc.; `09` doesn't include them |
| Topology diagram duplicated | `00-overview.md` and `13-deployment.md` both have it — easy to drift |
| `requireClientAccessBySlug` undefined | `08` calls it; `03` only defines `requireClientAccess(clientId)` |
| `computeRecipients` doesn't handle `INVITE_CONSUMED` audience "assigned team" | `14` table says assigned team is notified, but the audience function only handles 7 of 17 event types — the rest are TODO |
| `User.unreadNotifications` is added in `14` but `01` schema doesn't include it | `01` must be updated when `14` lands |
| `Notification` model isn't in `01` schema either | Same — `14` adds a model; `01` doesn't reflect it |
| `Session` table referenced in `02` for refresh tokens, but cookie rotation story says "refresh rotates on every use" | That implies two writes per refresh (revoke + create); `02` shows this in a `$transaction` but doesn't address the race (see `REVIEW.md` §3.2) |
| `10-security.md` recommends `__Host-` cookie prefix in prod but `02-authentication.md` example cookies don't use it | Two docs, two answers |
| `13-deployment.md` `vercel.json` config doesn't include the SSE `maxDuration` override mentioned in `14` | `14` references the config but `13` doesn't show it |
| `04-invites.md` says emails are not secret and gated by email match, but `01` schema has no `consumedBy` unique constraint | Two registrations from the same email against different slugs could be attempted (caught by `User.email` unique, but the Invite's `consumedBy` field has no integrity check) |

None of these is catastrophic. But they suggest the docs were written sequentially rather than edited as a whole. A second-pass edit is needed once the missing docs from `REVIEW.md` land.

## 6. What's still right (so we don't lose it)

To balance the criticism:

- The **3-layer authz enforcement** (proxy → UI → DAL) is correctly described and correctly assigns the security boundary to the DAL.
- The **App Router adaptation** with route groups and the `proxy.ts` rename is correct for Next 16.
- The **notification audience centralization** is the right instinct even if the implementation has gaps (`computeRecipients` covers 7/17 event types).
- The **storage adapter abstraction** is correctly minimal.
- The **two-phase migration policy** and cascade table are operationally mature.

The architecture isn't *wrong*. It's *shallow*. Domain modeling and event thinking are what separate "MVP that ships" from "system that scales past the team that built it."

## 7. Aggregate verdict after two passes

If `REVIEW.md`'s 8 missing docs are added and the 12 code bugs are fixed, the design covers ~80% of what an enterprise architect would expect from a *greenfield MVP*. To call it *production-grade at scale*, this second pass adds:

- Domain layer with entities and invariants (§2.1)
- Domain event bus (§2.2)
- Transactional outbox for audit + notifications (§2.3)
- Idempotency keys on mutations (§2.4)
- Postgres RLS as defense-in-depth (§2.5)
- Feature flag architecture (§2.6)
- ADRs (§2.7)
- Bounded context separation in the DAL (§2.8)
- SLO + error budget policy (§3.1)
- Runbooks (§3.2)
- Load test plan (§3.3)
- CI/CD design beyond a one-liner (§3.4)
- Impersonation feature (§3.5)
- Client state management decisions (§4.1)
- Accessibility doc + WCAG target (§4.2)
- i18n readiness even if English-only (§4.3)
- Source maps + client error reporting (§4.4)
- Bundle size budget (§4.5)
- Design system documentation (§4.6)
- Cross-doc consistency pass (§5)

That's another 20 items. Not all block v1, but a senior architect signing off on "production-grade" would want at least §2.1–2.4, §2.7, §3.1–3.3, and §4.2–4.3 addressed.

**Honest grade after second pass:** still B-minus, with the clarification that the gap to an A is *structural* (domain modeling, events, outbox), not *coverage*. Adding more docs alone won't close it; the existing docs need to be revised to reflect these patterns.

## 8. What I'd do next

If I were the architect picking this up:

1. Fix the 12 bugs in `REVIEW.md`. Half a day.
2. Decide explicitly whether this is MVP-grade (then ship) or enterprise-grade (then refactor per §2). The user said "production-grade" — that's the latter.
3. If enterprise-grade: write `15-non-functional-requirements.md` first. NFRs drive every choice in §2.
4. Refactor the design to introduce the domain layer (§2.1) and event bus (§2.2). This is the single biggest architectural change.
5. Add the outbox (§2.3). Audit-log writes go through it.
6. Then the missing docs from `REVIEW.md`.
7. Then the rigor items from §4.

Steps 4 and 5 are not optional if "production-grade" is the target. They're the difference between an app and a system.
