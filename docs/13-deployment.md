# 13 — Deployment

**Status:** Draft
**Primary target:** Vercel + Neon Postgres + S3-compatible storage + Upstash Redis
**Secondary target:** Docker (self-host) — documented but not actively maintained

## Topology

```
┌──────────────────────────────────────────────────────────┐
│  Vercel                                                  │
│  ─────                                                   │
│  • Next.js 16 build (Node 20)                            │
│  • Edge function: proxy.ts (Node runtime, not Edge)      │
│  • Serverless Functions: route handlers, server actions  │
│  • ISR / static: where possible                          │
│  • Cron: nightly cleanup, expiry sweep                   │
└──────────────────────────────────────────────────────────┘
         │             │              │
         ▼             ▼              ▼
   ┌─────────┐   ┌─────────┐   ┌────────────┐
   │  Neon   │   │   S3    │   │  Upstash   │
   │ Postgres│   │ (files) │   │   Redis    │
   └─────────┘   └─────────┘   └────────────┘
         │
         ▼
   ┌─────────┐
   │  SMTP   │   (Gmail / Resend / SES)
   └─────────┘
```

## Build pipeline

Vercel runs:
1. `npm ci` — install from lockfile.
2. `prisma generate` — needs to happen before `next build` so the client exists. Configured via `package.json` `postinstall`.
3. `next build` — type-checks, compiles, generates route handlers.

`package.json` additions:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "postinstall": "prisma generate || true",
    "db:migrate": "prisma migrate deploy",
    "db:migrate:dev": "prisma migrate dev",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

## Database migrations on deploy

Two strategies:

### A. `prisma migrate deploy` at build time (recommended for v1)

```bash
# In Vercel build command (override the default):
prisma migrate deploy && next build
```

- `migrate deploy` only applies pending migrations from `prisma/migrations/`. It will **not** create new migrations or reset data.
- Safe to run on every deploy — it's idempotent.
- **Risk:** if a migration is destructive (drops a column), it runs in prod without manual review. The two-phase migration policy in `01-data-model.md` is the mitigation.

### B. Manual via CLI (recommended once we have a staging tier)

```bash
# Approve PR → merge → run manually:
vercel env pull .env.production
prisma migrate deploy
vercel --prod
```

Slower deploys, but humans see the migration SQL before it runs in prod.

**Decision:** start with (A). Switch to (B) once we have an actual staging environment or any data we'd cry over.

## Neon configuration

- **Autoscaling:** enabled (min 0.25 CU, max 2 CU).
- **Auto-suspend:** 5 minutes (scales to zero when idle — fine for low-traffic periods).
- **Branching:** one branch per Vercel preview deploy via Neon's GitHub integration. Each PR gets an isolated database with the migration applied. PRs that touch the schema get reviewed in preview before merging.
- **Backups:** automatic PITR (point-in-time recovery) up to 7 days on free tier, 30 days on scale.

Connection string format:

```
postgresql://user:password@ep-<hash>.<region>.aws.neon.tech/dbname?sslmode=require&connect_timeout=15&pool_timeout=15
```

`sslmode=require` is mandatory. Long timeouts prevent cold-start failures.

## Prisma client singleton

Serverless = many short-lived function instances. Each one must not spawn a new Prisma client (kills the connection pool).

```ts
// lib/db.ts
import 'server-only'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

In production, Vercel reuses warm instances — the global is per-instance, but Prisma's pool handles it.

## Connection pool sizing

Neon's free tier allows 100 concurrent connections. Prisma's default `connection_limit` is `num_cpus * 2 + 1` — fine on dedicated hardware, problematic on serverless.

**Recommendation:** add `?connection_limit=5&pgbouncer=true` to the URL once we move off the free tier, and use PgBouncer in transaction mode. Neon supports this natively on the pooled connection string (different hostname — `-pooler` suffix).

## Storage (S3)

- Bucket policy: private, no public list/get. All access via presigned URL or server-streamed through route handlers.
- CORS: allow `PUT` from `NEXT_PUBLIC_APP_URL` only (for direct-to-S3 uploads).
- Lifecycle: move objects tagged `transient/` to IA after 30 days; delete after 365 days (configurable per client later).

## Email

SMTP (Nodemailer) in v1. Considerations:

- Gmail SMTP works for low volume. Switch to Resend or SES once we exceed ~500/day.
- Verifying SPF/DKIM/DMARC on the sending domain is **required** to avoid spam folders. Document this in the deploy runbook.

## Cron jobs

Defined in `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/webhooks/cron/cleanup-invites", "schedule": "0 3 * * 0" },
    { "path": "/api/webhooks/cron/expire-sessions",  "schedule": "0 * * * *" }
  ]
}
```

Each cron endpoint verifies `Authorization: Bearer ${CRON_SECRET}` header (Vercel sets it automatically).

| Job | Schedule | Purpose |
|-----|----------|---------|
| `cleanup-invites` | weekly | Delete CONSUMED/REVOKED invites older than 90 days |
| `expire-sessions` | hourly | Mark expired refresh tokens; mark expired invites |
| `cleanup-orphan-files` | daily | Scan storage for keys without a `File` row |

## Runtime selection

Per `next-best-practices/runtime-selection.md`:

- **Default (Node runtime)** for everything.
- **Edge runtime** only where strictly needed (not in v1). The proxy uses Node runtime so `jose` and any future Node-only deps work.

If we ever want the proxy on Edge for latency, we'd need an Edge-compatible JWT lib (jose already is) and no Node APIs. Out of scope.

## Docker (secondary)

For self-hosting / on-prem:

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Requires `output: 'standalone'` in `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: 'standalone',
}
```

Plus `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` set explicitly — otherwise each container has a different key and Server Action forms break across instances.

**Note:** Self-hosting means managing your own Postgres, Redis, and S3-compatible storage. Significantly more ops work. Not recommended unless required.

## CI

GitHub Actions (or equivalent):

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
      # Optional: npm test once we have a runner
```

PRs must pass lint, typecheck, build. Test job is a no-op until we add a runner.

## Preview deploys

Every PR gets a Vercel preview URL. The Neon integration creates a database branch for each preview, applies migrations, and seeds a minimal dataset.

Reviewers can:
- Click the Vercel bot's preview URL on the PR.
- Log in with the seed admin (`preview-admin@example.com` / shown in deploy summary).
- Test the change without affecting prod.

## Monitoring

- **Vercel Analytics** for Web Vitals.
- **Vercel Logs** (free tier: 1hr retention) or **Logflare** / **Axiom** for longer.
- **Sentry** for error reporting (see `11-error-handling-and-observability.md`).
- **Neon** for DB metrics (query time, connection count).
- **UptimeRobot** or Better Stack hitting `/api/health` from outside.

## Deploy runbook (first production deploy)

1. Provision Neon project. Run `prisma migrate deploy` once manually to create the schema.
2. Create S3 bucket; create IAM user with bucket policy.
3. Create Upstash Redis database.
4. Set all env vars in Vercel (production environment). Generate secrets with `openssl rand -base64 32`.
5. Configure `NEXT_PUBLIC_APP_URL` to the final domain.
6. Configure DNS to point at Vercel.
7. Configure SPF/DKIM/DMARC on the sending domain.
8. Deploy via `vercel --prod`.
9. Run the admin seed once (or create the first admin via SQL) — see `prisma/seed.ts`.
10. Generate the first invite link from the admin UI; do a full registration walkthrough.

## Open questions

- **Blue/green deploys.** Vercel doesn't natively support these. Atomic deploys + migrations that are backwards-compatible is the workaround. No plans to change.
- **Multi-region.** Vercel handles global CDN; functions run in a single region (iad1 by default). For latency-sensitive clients, consider moving functions to their region. Out of scope v1.
