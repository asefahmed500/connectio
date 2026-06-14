# Review 4 — Enterprise SaaS Axis

**Reviewer:** design author, fourth pass with target clarified
**Target:** **Enterprise SaaS** — multi-tenant B2B, paying customers, SOC 2 Type II within ~12 months of launch
**Subject:** `docs/00`–`14` + `REVIEW.md`/`REVIEW-2.md`/`REVIEW-3.md`
**Verdict:** **C-minus at the enterprise bar.** The design is the same artifact reviewed three times; what changed is the standard we measure against. For Enterprise SaaS, the gap shifts from architecture (covered) to *program* — SOC 2 controls, supply chain, defense in depth, customer trust artifacts. The fixes are less about code and more about process, evidence, and ongoing programs.

This pass assumes `REVIEW-3.md` Tier 0 + Tier 1 will land. Without those, the items below are premature.

---

## 1. Why the grade drops at the enterprise bar

The B-minus grade in `REVIEW-3.md` is calibrated against *generic production-grade*. Enterprise SaaS is a stricter standard:

- Customers will run **security reviews** before signing. They'll send a 200-question vendor assessment.
- Procurement will require **SOC 2 Type II** before contracts above $X.
- Legal will require a **DPA** and to vet every sub-processor.
- Customer security teams will probe for **breach notification policy**, **data residency**, **encryption at rest**, **access logging**.
- Renewals trigger **annual reassessment**. A gap found at renewal loses the customer.

The current design answers none of these. It's not that the architecture is wrong — it's that the artifacts enterprises need don't exist.

## 2. SOC 2 readiness — the unifying framework

SOC 2 Type II audits evidence **Trust Service Criteria**: Security, Availability, Processing Integrity, Confidentiality, Privacy. The design needs to map to these.

### 2.1 Control mapping is missing

For each SOC 2 control (e.g. CC6.1 "logical access controls"), we need to say *where* in the system it's enforced and *what evidence* we generate. Currently:

| SOC 2 control | Where enforced? | Evidence |
|---------------|-----------------|----------|
| CC6.1 (logical access) | `02-authentication.md` + `03-rbac.md` | Audit log entries? Yes. Access review process? No. |
| CC6.6 (logical access revocation) | Session table supports it; process for offboarding team members? No. | None. |
| CC7.1 (vulnerability detection) | CI runs lint/build. SCA? SAST? DAST? No. | None. |
| CC7.2 (anomaly detection) | Rate limits in `10-security.md`. Beyond that? No. | None. |
| CC8.1 (change management) | PR + Vercel deploy. Approval gates? Required reviewers? No. | None. |
| A1.1 (capacity monitoring) | Vercel dashboards. Alerting? SLO breaches? No. | None. |
| C1.1 (confidentiality) | HTTPS, argon2id, encrypted at rest via Neon. Field-level PII encryption? No. | None. |

**Fix:** add `docs/soc2-control-matrix.md`. Map every applicable control to: (a) where enforced, (b) what evidence is generated, (c) who owns it, (d) review cadence. This document is what the auditor reads first.

### 2.2 Access reviews — quarterly process missing

SOC 2 requires evidence that we *review* who has access to production, regularly. The design has no process for this.

**Fix:** quarterly access review checklist:
- List all `SUPER_ADMIN` users; confirm each still needs it.
- List all Vercel/Neon/S3/Upstash team members; remove stale.
- List all SSH keys / deploy keys / API tokens; rotate any >90 days old.
- Document the review (date, reviewer, deltas) — store in a SOC 2 evidence repo.

Without this, an auditor flags it as a control gap.

### 2.3 Change management — segregation of duties missing

SOC 2 wants evidence that the person who *writes* code isn't the only person who *approves* and *deploys* it. The design's CI (one job, lint+typecheck+build) doesn't enforce:

- Required reviewers (e.g. ≥1 approval on PRs to `main`).
- CODEOWNERS for security-sensitive paths (`proxy.ts`, `lib/auth/`, `prisma/migrations/`).
- Deployment approver distinct from author.
- Emergency change procedure (with retro approval).

**Fix:** document change management policy. Wire branch protection, CODEOWNERS, merge queue. An auditor reads this as evidence of control CC8.1.

### 2.4 Vendor risk management — subprocessor vetting missing

Every sub-processor (Vercel, Neon, AWS S3, Upstash, SMTP provider) needs:

- A signed DPA.
- SOC 2 report (or equivalent) on file.
- Annual reassessment.

Currently the design says "Vercel + Neon + S3 + Upstash" without acknowledging the compliance surface this creates.

**Fix:** `docs/subprocessors.md`. Public-facing. Lists every sub-processor, their role, their certifications, their DPA status. This page is linked from the customer-facing trust center.

## 3. Supply chain & dependency security

### 3.1 No SBOM generation

Federal procurement and many enterprise customers now require a Software Bill of Materials. We can't produce one.

**Fix:** generate CycloneDX SBOM on every build. Store as build artifact. Provide to customers on request. Tooling: `@cyclonedx/cyclonedx-npm` in CI.

### 3.2 No dependency review on PRs

`npm audit` runs in CI (per `10-security.md`), but it's reactive — it finds vulnerabilities *after* they're in the lockfile. No gate prevents a PR from introducing a vulnerable dependency.

**Fix:** GitHub Dependabot or Snyk PR reviews. Block merge if PR introduces a high/critical CVE.

### 3.3 No signature verification

NPM packages can be typosquatted. `package-lock.json` doesn't verify provenance. SLSA Level 3+ requires verified artifacts.

**Fix:** enable npm provenance verification. Use `--provenance` on internal package publishes. Not a v1 blocker, but flag for SOC 2 evidence.

### 3.4 No license compliance check

Enterprise customers care about license exposure (GPL, AGPL). No tool scans for problematic licenses.

**Fix:** `license-checker` or `license-auditor` in CI. Fail build on copyleft licenses in dependencies.

## 4. Defense in depth — beyond the application layer

`10-security.md` covers app-layer concerns. Enterprise SaaS needs more.

### 4.1 No WAF

Vercel's built-in protections exist but aren't configured. SQL injection is mitigated by Prisma, XSS by React escaping, CSRF by Origin checks — but a WAF catches *unknown unknowns* (zero-days in dependencies, novel attack patterns).

**Fix:** Cloudflare in front of Vercel, or Vercel Firewall (Pro/Enterprise). Managed rules (OWASP Core Rule Set). Custom rules for known bad patterns. Anomaly scoring.

### 4.2 No DDoS protection beyond Vercel default

Vercel has volumetric DDoS protection. Application-layer DDoS (slow-loris on uploads, SSE connection floods, login storms) is not addressed beyond per-endpoint rate limits.

**Fix:** rate-limit at edge (Cloudflare or Vercel Firewall). Connection-count limits. JS challenge for suspicious traffic. Document the thresholds.

### 4.3 No anomaly detection on auth events

`02-authentication.md` rate-limits login. It doesn't *alert* on patterns: "user X logged in from a new country," "20 failed logins across 5 accounts from same IP," "admin role elevated outside business hours."

**Fix:** stream auth events to a SIEM (Vercel Logflare → Datadog, or dedicated). Define detection rules. Alert security channel on match.

### 4.4 No DLP — outbound data leakage

An admin (compromised or malicious) could bulk-export client data via the API. Nothing flags this.

**Fix:** alert on high-volume reads (e.g. >50 client records in 5 minutes per user). Alert on first-time-ever bulk export. Log to audit; page security team.

### 4.5 Security headers depth

`10-security.md` covers CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy. Missing:

- **COEP** (`Cross-Origin-Embedder-Policy: require-corp`) — enables cross-origin isolation; needed if we ever use `SharedArrayBuffer`.
- **COOP** (`Cross-Origin-Opener-Policy: same-origin`) — mitigates cross-origin window-handle attacks.
- **CORP** (`Cross-Origin-Resource-Policy: same-origin`) — prevents cross-origin resource inclusion.
- **X-DNS-Prefetch-Control: off** — disables prefetching that can leak browsing patterns.
- **X-Permitted-Cross-Domain-Policies: none** — Adobe cross-domain policy.

**Fix:** extend the `next.config.ts` headers list. Document why each header matters.

### 4.6 Reverse tabnabbing

External links without `rel="noopener noreferrer"` allow the opened page to access `window.opener` and redirect the original tab. React 19 + modern browsers default to noopener on `target="_blank"`, but `<a target="_blank">` in MDX or rendered HTML is still vulnerable.

**Fix:** lint rule banning `target="_blank"` without `rel="noopener"`. Content Security Policy `navigate-to` directive (experimental).

### 4.7 Subresource Integrity (SRI)

We don't currently load third-party scripts. The moment we do (analytics, error reporting, font CDNs), they need SRI hashes:

```html
<script src="https://cdn.example.com/lib.js"
        integrity="sha384-..."
        crossorigin="anonymous"></script>
```

**Fix:** policy doc. Any external script requires SRI. Lint check on the rendered HTML.

## 5. PII & data protection depth

### 5.1 No field-level encryption for PII

Currently: passwords hashed via argon2id. Everything else (emails, contact names, project briefs, file contents) is plaintext in Postgres. Neon encrypts at rest (transparent disk encryption), but a SQL injection (or DB dump from a stolen backup) exposes everything.

For enterprise customers with strict data-protection clauses, this is below the bar.

**Fix:** application-layer encryption for high-sensitivity fields:
- `User.email` → encrypted with `DATA_ENCRYPTION_KEY`. Index via `email_hash` (HMAC) for lookups.
- `Client.contactName`, `Client.companyName` → encrypted.
- `Comment.message` → encrypted.
- `Submission.formData` → encrypted (it's business-confidential).

Use a library like `@node-rs/argon2` for password hashing (already done) and `node:crypto` AES-256-GCM for fields. Document key rotation (envelope encryption with KMS at scale; Phase 2).

**Severity:** high for enterprise. Many procurement security reviews flag this.

### 5.2 No customer-managed encryption keys (CMEK)

Some enterprises require that *they* hold the encryption key, so that even with full DB access we can't read their data. This is a separate tenant-per-key architecture; not v1, but design now.

**Fix:** document as Enterprise-tier feature. Note that adding it requires per-tenant key derivation, which the current single-tenant-key encryption design doesn't support. Trade-off: complexity vs. addressable market.

### 5.3 No data classification policy

Without a classification scheme (Public / Internal / Confidential / Restricted), each field's protection level is ad-hoc.

**Fix:** `docs/data-classification.md`. Tag every field in `01-data-model.md` with its classification. Map each class to controls (encryption, masking in logs, retention).

### 5.4 No data retention policy

`AuditLog` is "append-only" indefinitely. `Notification` is 90 days. `Submission` is forever. `File` is forever. Without explicit retention:

- Storage costs grow unbounded.
- GDPR right-to-be-forgotten becomes "delete everything related to this user" — manual and error-prone.
- Legal hold (when a customer disputes something) is ad-hoc.

**Fix:** define retention per data class. Automate via cron. Document legal-hold override. Add to `21-privacy-and-compliance.md` (which doesn't exist yet — see `REVIEW.md` §2.7).

## 6. Audit & monitoring depth

### 6.1 Audit log has no tamper-evidence

`AuditLog` rows are appendable by any DB user with write access. A malicious DBA (or SQL injection with write privileges) can edit or delete entries. For SOC 2 and for forensic value, audit logs need to be tamper-evident.

**Fix:** hash-chain each row: `hash = sha256(prev_hash || row_data)`. Periodically notarize the latest hash (write to a public blockchain, or to a separate immutable WORM store like AWS S3 Object Lock). Detect tampering on read by recomputing the chain.

For high-confidence evidence, write audit events to two stores: the Postgres table (for queryability) + an S3 bucket with Object Lock (for tamper-evidence).

### 6.2 No DB-level audit

App-level audit (`writeAudit`) catches what we remember to log. DB-level audit (DDL/DML triggers) catches *everything*: schema changes, manual fixes, anything run via `psql`. Required for SOC 2 evidence.

**Fix:** enable Postgres `pgaudit` extension on Neon. Stream to a log destination with 1-year retention. Review monthly.

### 6.3 No slow query monitoring

The design has indexes (well). It doesn't monitor for queries that bypass indexes, regress over time, or appear only in production data shapes.

**Fix:** Neon's query statistics dashboard (built-in). Datadog DBM or pganalyze for deeper insight. Alert on queries averaging >500ms.

### 6.4 No structured alerting

`11-error-handling-and-observability.md` covers logging and traces. It doesn't cover *alerting* — what wakes someone up at 3am.

**Fix:** define alert rules. PagerDuty or Opsgenie integration. Examples:
- Error rate > 1% for 5 minutes.
- P95 latency > target for 10 minutes.
- DB connection count > 80% of pool.
- SSE connection count > threshold.
- Failed login rate > baseline.
- Audit log write failures > 0 (these should never fail; treat as P1).

## 7. Customer-facing trust artifacts

These are non-code, non-architectural items that procurement teams require.

### 7.1 Trust center

A `/security` page on the marketing site with:
- SOC 2 report (under NDA).
- Security overview (encryption, access controls, sub-processors).
- Incident response policy summary.
- Breach notification commitment.
- Vulnerability disclosure policy.
- Status page link.

### 7.2 DPAs and sub-processor list

Standard DPA template, signed per customer. Sub-processor list with 30-day change notification.

### 7.3 Breach notification policy

SLA: notify affected customers within 72 hours of confirmed breach (GDPR-aligned). Document the definition of "confirmed breach," the assessment process, and the comms template.

### 7.4 Vulnerability disclosure program (VDP)

A `security@` address with a published policy: scope, safe harbor, response SLAs. Doesn't have to be a paid bug bounty initially; a clear VDP is enough for most enterprises.

### 7.5 Status page

Independent of the app (so it's up when the app is down). Statuspage.io or equivalent. Incident history, uptime by service, subscriber notifications.

## 8. Engineering rigor tooling

These make SOC 2 evidence *cheap* and make regressions visible before customers see them.

### 8.1 No static analysis security testing (SAST)

CI runs ESLint. ESLint finds style bugs. It doesn't find:
- SQL injection patterns (we use Prisma, but `queryRaw` exists).
- Hardcoded secrets.
- Insecure random.
- Path traversal.

**Fix:** add Semgrep (free OSS ruleset) + GitHub CodeQL to CI. Block merge on high-confidence findings.

### 8.2 No container/dependency scanning beyond NPM audit

Snyk or Dependabot for known CVEs. Trivy for container scanning (if we use Docker). Vercel build-time scans.

### 8.3 No secret scanning in CI

A hardcoded `JWT_SECRET` in a commit is a P0 incident. GitHub secret scanning catches this on push.

**Fix:** enable GitHub secret scanning + push protection. Consider `gitleaks` in pre-commit.

### 8.4 No contract testing

API docs (`09-api-contracts.md`) describe the contract. Nothing enforces it. A backend change can silently break a client.

**Fix:** Pact or OpenAPI-based contract tests. Generate client types from a single OpenAPI source. CI runs both producer and consumer tests.

### 8.5 No visual regression testing

shadcn UI changes can subtly break layouts. No test catches it.

**Fix:** Chromatic or Playwright snapshot tests. Run on every PR. Flag visual diffs for review.

### 8.6 No Lighthouse CI / performance regression

Vercel Analytics tells you performance *now*. It doesn't fail the build when performance regresses.

**Fix:** Lighthouse CI in GitHub Actions. Budget: LCP < 2.5s, INP < 200ms, CLS < 0.1. Block merge on regression beyond budget.

### 8.7 No load testing

`REVIEW-2.md` §3.3 already flagged this. Reiterating because it's also SOC 2 evidence (capacity planning control A1.2).

## 9. Updated roadmap — Enterprise SaaS bar

Tiers 0 and 1 from `REVIEW-3.md` still apply. Enterprise SaaS adds Tier 1.5 (compliance work that doesn't change architecture but creates required artifacts).

### Tier 1.5 — Enterprise compliance work (new)

| # | Item | Source | Effort |
|---|------|--------|--------|
| 1.5.1 | SOC 2 control matrix doc (§2.1) | R4 | 3 days |
| 1.5.2 | Access review process + first review (§2.2) | R4 | 2 days |
| 1.5.3 | Change management policy + CODEOWNERS (§2.3) | R4 | 1 day |
| 1.5.4 | Sub-processor list + DPA templates (§2.4, §7.2) | R4 | 3 days |
| 1.5.5 | SBOM generation in CI (§3.1) | R4 | 1 day |
| 1.5.6 | Dependency review gate (§3.2) | R4 | 1 day |
| 1.5.7 | License compliance check (§3.4) | R4 | 0.5 days |
| 1.5.8 | Cloudflare WAF + rules (§4.1) | R4 | 2 days |
| 1.5.9 | Anomaly detection rules (§4.3) | R4 | 3 days |
| 1.5.10 | DLP on bulk reads (§4.4) | R4 | 2 days |
| 1.5.11 | Security headers extension (§4.5) | R4 | 0.5 days |
| 1.5.12 | Field-level PII encryption (§5.1) | R4 | 5 days |
| 1.5.13 | Data classification doc (§5.3) | R4 | 1 day |
| 1.5.14 | Data retention policy + automation (§5.4) | R4 | 3 days |
| 1.5.15 | Audit log hash chain + Object Lock (§6.1) | R4 | 3 days |
| 1.5.16 | pgaudit + log shipping (§6.2) | R4 | 1 day |
| 1.5.17 | Slow query monitoring + alerting (§6.3, §6.4) | R4 | 2 days |
| 1.5.18 | Trust center page (§7.1) | R4 | 2 days |
| 1.5.19 | Breach notification policy + templates (§7.3) | R4 | 1 day |
| 1.5.20 | VDP (§7.4) | R4 | 1 day |
| 1.5.21 | Status page (§7.5) | R4 | 0.5 days |
| 1.5.22 | SAST in CI (Semgrep + CodeQL) (§8.1) | R4 | 1 day |
| 1.5.23 | Secret scanning + push protection (§8.3) | R4 | 0.5 days |
| 1.5.24 | Contract testing (Pact) (§8.4) | R4 | 3 days |
| 1.5.25 | Visual regression (Chromatic) (§8.5) | R4 | 1 day |
| 1.5.26 | Lighthouse CI (§8.6) | R4 | 1 day |

**Tier 1.5 total: ~45 days.** Mostly process and tooling work; some (1.5.12, 1.5.15) are real engineering.

### Cumulative for Enterprise SaaS

- **Tier 0** (R3): ~13 days — must ship
- **Tier 1** (R3): ~32 days — architectural depth
- **Tier 1.5** (this doc): ~45 days — compliance/program
- **Total: ~90 working days**, or ~4-5 months for one engineer.

Two engineers in parallel with clearly divided workstreams (one on Tier 1 architecture, one on Tier 1.5 compliance) can compress to ~10-12 weeks.

### What's *not* on this list (deferred past Enterprise SaaS)

- **HIPAA / FedRAMP** — requires dedicated compliance work, federal authorization, way longer timelines. Pick this only if a specific customer requires it.
- **CMEK** (§5.2) — design now, defer implementation. Adds a top-tier plan SKU; not blocking.
- **Single-tenant deployment** — only for the largest customers; design only.
- **Active-active multi-region** — Vercel handles failover; active-active DB is a serious commitment.

## 10. Final grade at the Enterprise SaaS bar

| Dimension | Grade | Why |
|-----------|-------|-----|
| Architecture (generic) | B-minus | Per prior reviews |
| Architecture (enterprise) | B-minus | Same — architecture isn't the gap |
| SOC 2 readiness | D-plus | Control matrix, access reviews, change mgmt all missing |
| Supply chain | D | No SBOM, no dep review, no signature verification |
| Defense in depth | C-minus | App-layer covered; WAF, anomaly, DLP missing |
| PII protection | D | No field-level encryption, no classification |
| Audit integrity | D-plus | App-level only; no tamper-evidence, no DB-level audit |
| Customer trust artifacts | F | Nothing exists — no trust center, DPA, VDP |
| Engineering rigor tooling | D | No SAST, contract tests, visual regression, Lighthouse |
| Data residency / multi-region | D | Single region; no EU option |
| Data lifecycle | D-minus | No retention policy, no classification |

**Aggregate for Enterprise SaaS: C-minus.** Lower than the B-minus for generic production because the bar is higher and the gap is wider.

## 11. What "Enterprise production-grade" actually requires

To honestly call this enterprise-ready, all three of:

1. **Tier 0** from `REVIEW-3.md` (bug fixes, 2FA, CAPTCHA, idempotency, outbox, NFRs, GDPR, testing docs, concurrency fix).
2. **Tier 1** from `REVIEW-3.md` (domain layer, event bus, API tokens, outbound webhooks, capacity, DR, RLS, ADRs, SLO, runbooks, search, analytics).
3. **Tier 1.5** from this doc (SOC 2 work, supply chain, defense in depth, PII encryption, audit integrity, trust artifacts, rigor tooling).

Anything less is "MVP that enterprise procurement will reject."

## 12. Recommendation

Stop reviewing. The four passes have now covered:
- **Architecture and code correctness** (R1, R2)
- **Process and rigor** (R2, R3)
- **Compliance and enterprise hardening** (this doc)

A fifth pass would either repeat or push into specialized territory (HIPAA, FedRAMP, multi-region active-active) that's beyond the stated target.

The next move is implementation. Suggested order:

1. **Week 1-2:** Tier 0 from R3 — NFRs doc, GDPR doc, testing doc, fix the 12 code bugs, add 2FA + CAPTCHA + idempotency + outbox.
2. **Week 3-6:** Tier 1 from R3 — domain layer, event bus, RLS, API tokens, ADRs, runbooks.
3. **Week 7-12:** Tier 1.5 from this doc — SOC 2 work, PII encryption, supply chain, trust artifacts.

By end of week 12, the system is honestly enterprise-grade. Until then, every "production-grade" claim is conditional.

The four reviews (`REVIEW.md`, `REVIEW-2.md`, `REVIEW-3.md`, this doc) form a complete audit. Use them as the implementation backlog.
