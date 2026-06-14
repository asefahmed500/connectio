# 12 — Environment & Config

**Status:** Draft

All configuration flows through environment variables. The app reads them once at boot via a single typed module (`lib/env.ts`) that validates presence and shape, then exposes a frozen object. No other module reads `process.env` directly.

## Variable catalog

### Required in every environment

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pw@host/db?sslmode=require` | Prisma datasource. Neon/Supabase in prod. |
| `AUTH_JWT_SECRET` | `openssl rand -base64 32` | HS256 signing key for access tokens. ≥ 32 bytes. |
| `AUTH_PASSWORD_PEPPER` | `openssl rand -base64 32` | Optional pepper applied via HMAC before argon2. ≥ 32 bytes. |
| `NEXT_PUBLIC_APP_URL` | `https://portal.example.com` | Used for absolute URLs in emails and invite links. |

### Required in production

| Variable | Example | Purpose |
|----------|---------|---------|
| `S3_BUCKET` | `clientconnect-prod` | File storage bucket. |
| `S3_REGION` | `us-east-1` | Bucket region. |
| `S3_ACCESS_KEY` | `AKIA...` | IAM access key with write+read+delete on the bucket. |
| `S3_SECRET` | `(secret)` | IAM secret. |
| `UPSTASH_REDIS_REST_URL` | `https://...upstash.io` | Rate limiting. |
| `UPSTASH_REDIS_REST_TOKEN` | `(secret)` | Rate limiting auth. |
| `SMTP_HOST` | `smtp.gmail.com` | Outbound email. |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) or `465` (TLS). |
| `SMTP_USER` | `notifications@example.com` | SMTP auth. |
| `SMTP_PASS` | `(app password)` | SMTP auth. |
| `SMTP_FROM` | `"ClientConnect <noreply@example.com>"` | From header. |

### Optional / advanced

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Server listen port. |
| `NODE_ENV` | `development` | Standard. Vercel sets `production` automatically. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | (random per build) | Pin Server Action encryption across instances. `openssl rand -base64 32`. |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (unset) | OTLP collector URL for traces. |
| `SENTRY_DSN` | (unset) | Sentry error reporting. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | (unset) | Used by `prisma db seed` only. |
| `CRON_SECRET` | (unset) | Shared secret for Vercel Cron webhook verification. |
| `MAX_UPLOAD_BYTES` | `52428800` (50 MB) | Upload size cap. |

### Public (must be `NEXT_PUBLIC_*` to reach the browser)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | The only one. Browser never needs secrets. |

## Boot-time validation

```ts
// lib/env.ts
import 'server-only'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_PASSWORD_PEPPER: z.string().min(32).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET: z.string().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),

  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  MAX_UPLOAD_BYTES: z.coerce.number().default(50 * 1024 * 1024),

  NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  SENTRY_DSN: z.string().url().optional(),
  CRON_SECRET: z.string().optional(),
})

function parseEnv() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment configuration')
  }

  // Cross-cutting rules
  if (parsed.data.NODE_ENV === 'production') {
    const missing = [
      'S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET',
      'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    ].filter(k => !parsed.data[k as keyof typeof parsed.data])
    if (missing.length) {
      throw new Error(`Missing required prod env vars: ${missing.join(', ')}`)
    }
  }

  return Object.freeze(parsed.data)
}

export const env = parseEnv()
```

Imported by `instrumentation.ts` so it runs at boot. Any failure stops the app from starting — better than a runtime crash 30 minutes into a request.

## `.env.local` (development)

Already exists in the repo. Format:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/connectio"

# Auth
AUTH_JWT_SECRET="generate-with-openssl-rand-base64-32"
# AUTH_PASSWORD_PEPPER="optional"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
PORT=3000
NODE_ENV=development
```

`.env.local` is gitignored. `.env.example` is committed and serves as documentation:

```bash
cp .env.example .env.local
```

## `.env.example`

Committed. Lists every variable with a placeholder value and a comment. Update this whenever you add a variable.

## Production (Vercel)

Set in the Vercel dashboard or via CLI:

```bash
vercel env add DATABASE_URL production
vercel env add AUTH_JWT_SECRET production
# ...
```

Preview deploys inherit from production by default, with overrides per branch (e.g. a separate `DATABASE_URL` for preview on Neon branching).

## Secret rotation

| Secret | Rotation procedure |
|--------|---------------------|
| `AUTH_JWT_SECRET` | Set new value. All existing access tokens become invalid immediately (they'll fail `jwtVerify`). Refresh tokens in the DB are unaffected; users get a seamless new access token on next `/api/auth/refresh`. To force logout everyone: also `UPDATE "Session" SET "revokedAt" = now() WHERE "revokedAt" IS NULL`. |
| `AUTH_PASSWORD_PEPPER` | Two-phase. Add new pepper as `AUTH_PASSWORD_PEPPER_NEW`. On login, re-hash with new pepper. After all active users have logged in once, swap peppers. Until then, both are tried. (Out of scope for v1 — pepper is optional.) |
| `S3_ACCESS_KEY` / `S3_SECRET` | Create new IAM key, add as new env, deploy. Remove old key once deploy is healthy. |
| `SMTP_PASS` | Same as S3. |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Rotation invalidates all in-flight Server Action forms. Acceptable; users retry. |

## What never goes in env

- Per-user config. That belongs in the DB (`User`, `Client`, `Form`).
- Feature flags. Use a DB-backed flag table or Vercel's toolbar; env-var flags lead to stale UI after toggling.
- Anything used by the browser without `NEXT_PUBLIC_` prefix. The build will reject it.

## Open questions

- **Secrets manager** (Doppler, Vault). At our scale, Vercel's encrypted env vars are sufficient. Move to a secrets manager when we have > 1 service or non-Vercel deploys.
