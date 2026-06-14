import 'server-only'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET must be at least 32 chars'),
  AUTH_PASSWORD_PEPPER: z.string().min(32).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

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

  if (parsed.data.NODE_ENV === 'production') {
    const required = [
      'S3_BUCKET', 'S3_REGION', 'S3_ACCESS_KEY', 'S3_SECRET',
      'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
    ] as const
    const missing = required.filter((k) => !parsed.data[k])
    if (missing.length) {
      throw new Error(`Missing required production env vars: ${missing.join(', ')}`)
    }
  }

  return Object.freeze(parsed.data)
}

export type Env = ReturnType<typeof parseEnv>

let cached: Env | null = null

export function getEnv(): Env {
  if (cached) return cached
  cached = parseEnv()
  return cached
}
