# 10 — Security

**Status:** Draft
**Scope:** application-layer security. Infra (Vercel, Neon) is covered in `13-deployment.md`.

This doc is the operational checklist and rationale. Cross-cutting security topics (auth, RBAC) live in their own docs; this one is about defense-in-depth beyond them.

## Threat surface

1. **Authentication & session forgery** → `02-authentication.md`
2. **Authorization / IDOR** → `03-rbac-and-data-isolation.md`
3. **CSRF on mutations** → this doc
4. **XSS via user-generated content** (comments, rich text, file names) → this doc
5. **File upload abuse** (malicious MIME, oversized, infected) → `07-uploads.md`
6. **Rate-limit / brute-force attacks** → this doc
7. **Secret management** → `12-env-and-config.md`
8. **Dependency vulnerabilities** → this doc
9. **Information disclosure via errors** → `11-error-handling-and-observability.md`

## CSRF protection

**Server Actions** are CSRF-protected by Next 16 itself:
- They only accept `POST`.
- They check `Origin` header against `Host` / `X-Forwarded-Host`. Mismatch → request aborted.
- Cookies are `SameSite=Lax`, which blocks most cross-site form submissions anyway.

**Route Handlers** for mutations (uploads, webhooks) need explicit CSRF protection:

```ts
// lib/security/csrf.ts
import 'server-only'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export async function checkOrigin(): Promise<NextResponse | null> {
  const h = await headers()
  const origin = h.get('origin')
  const host = h.get('host') ?? h.get('x-forwarded-host')
  if (!origin || !host || new URL(origin).host !== host) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }
  return null
}
```

Used at the top of any mutating route handler that accepts cookies.

For webhook endpoints, use a signature header instead (per-provider).

## XSS protection

### User-generated content types

| Source | Risk | Mitigation |
|--------|------|------------|
| Comment body (plain text) | Low | Render with `{message}` (React escapes by default). No HTML allowed. |
| Form values (any) | Medium | Same as above; values are data, never HTML. |
| File names | Low | Always render as text, never in URL interpolation. |
| Rich text (`richtext` field) | **High** | Use a sanitizer. See below. |

### Rich text rendering

If we add a `richtext` field type (currently the schema supports it but we don't render arbitrary HTML), the pipeline is:

1. **Editor:** TipTap or similar, outputting structured JSON (ProseMirror doc).
2. **Storage:** store the JSON, not HTML.
3. **Render:** serialize JSON → React elements via a fixed renderer. Never `dangerouslySetInnerHTML`.

If we ever need to render user-supplied HTML (we shouldn't), use `dompurify` server-side with an allowlist.

### Content Security Policy

Set via `next.config.ts`:

```ts
// next.config.ts
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",         // Next needs inline for hydration; consider nonces later
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.upstash.app",  // rate limit calls
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
]

export default {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp.join('; ') },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }]
  },
}
```

### Nonces for inline scripts (Phase 2)

The `'unsafe-inline'` for scripts is acceptable in v1 but should be replaced with per-request nonces once we have time to test:

```ts
// nonce generated in middleware, attached to <Script nonce={...}> and CSP header
```

## Rate limiting

Token-bucket. Per-IP and per-user. Implementation in `lib/ratelimit/`:

```ts
// lib/ratelimit/index.ts
import 'server-only'
import { redis } from '@/lib/redis'   // null in dev

export interface RateBucket {
  limit: number
  window: number    // seconds
}

export async function rateLimit(key: string, bucket: RateBucket): Promise<{ ok: boolean; retryAfter: number }> {
  if (redis) return rateLimitRedis(key, bucket)
  return rateLimitMemory(key, bucket)
}
```

| Function | Default bucket |
|----------|----------------|
| `login:ip:<ip>` | 10 / 60s |
| `login:email:<email>` | 5 / 300s |
| `register:ip:<ip>` | 5 / 3600s |
| `register:slug:<slug>` | 3 / 3600s |
| `upload:user:<userId>` | 50 / 3600s |
| `comment:user:<userId>` | 30 / 60s |
| `api:user:<userId>` | 300 / 60s |
| `api:ip:<ip>` (unauth) | 100 / 60s |

Returns `Retry-After` header on 429. UI shows "Try again in N seconds".

## SQL injection

Not directly applicable — Prisma parameterizes all queries. The risk surfaces if we ever use `$queryRaw`:

- **Never** interpolate user input into `$queryRaw`.
- Use `$queryRaw\`...${var}\`` tagged template (Prisma parameterizes these). Not the function-call form.

Lint rule blocks `$queryRaw` calls that aren't tagged-template.

## Dependency hygiene

- `npm audit` runs in CI; high/critical fails the build.
- Renovate bot bumps minor/patch weekly; majors require review.
- No `postinstall` scripts from untrusted packages (NPM config `ignore-scripts` for non-build deps).

## Cookie hygiene

- Prefix session cookies with `__Host-` in production (forces Secure, Path=/, no Domain).
- Don't store anything sensitive in non-HttpOnly cookies.
- Don't set cookies in render path. Only in Server Actions / Route Handlers (Next 16 enforces this).

## Logging & secrets

- **Never log** tokens, password hashes, refresh tokens, or PII.
- `console.error` is fine for stack traces; structured logging uses a sanitizer (see `11-error-handling-and-observability.md`).
- Secrets loaded once at boot into a typed object (`lib/env.ts`); never read `process.env` elsewhere.

## Audit log

The `AuditLog` table is the application's accountability primitive. Every privileged read/write records:

| Field | Example |
|-------|---------|
| `userId` | cuid of actor (null for system actions) |
| `action` | `CLIENT_VIEWED`, `INVITE_REVOKED`, `SUBMISSION_APPROVED`, etc. |
| `resource` | Model name |
| `resourceId` | PK |
| `changes` | JSON diff `{ before, after }` for mutations |
| `ip` | Client IP |
| `userAgent` | UA string |
| `createdAt` | timestamp |

Written via `after()` to avoid blocking responses. Queryable from `/admin/audit` (Super Admin only).

## OWASP Top 10 mapping

| OWASP risk | Where covered |
|------------|---------------|
| A01 Broken Access Control | `03-rbac-and-data-isolation.md` |
| A02 Cryptographic Failures | `02-authentication.md` (argon2, jose, HTTPS) |
| A03 Injection | Prisma parameterization; this doc (SQL section) |
| A04 Insecure Design | This whole docs folder |
| A05 Security Misconfiguration | `next.config.ts` headers; `12-env-and-config.md` |
| A06 Vulnerable Components | Dependency hygiene (above) |
| A07 Identification & Auth Failures | `02-authentication.md` |
| A08 Software & Data Integrity | NPM lockfile, signature checks for webhooks |
| A09 Security Logging | Audit log (above) |
| A10 SSRF | No user-controlled URL fetching in v1 |

## Incident response

Out of scope for design doc, but the audit log + structured logging + vercel observability give us:
- Who did what, when, from where.
- Reproducible request traces via `requestId`.
- Database snapshots on Neon (point-in-time recovery) for forensics.

Runbooks (rotate JWT secret, force-logout all users, etc.) live in a separate ops wiki once we ship.
