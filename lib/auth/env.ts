import 'server-only'
import { z } from 'zod'

const schema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET must be at least 32 chars'),

  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Cloudflare R2 (S3-compatible object storage)
  // Gmail OAuth2
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GMAIL_USER: z.string().email().optional(),

  // Gmail App Password
  GMAIL_APP_PASSWORD: z.string().optional(),

  // Cloudflare R2 (S3-compatible object storage)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  // AWS S3 / S3-compatible
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET: z.string().optional(),
  S3_ENDPOINT: z.string().url().optional(),

  UPSTASH_REDIS_REST_URL: z.string().optional(),
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
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  CRON_SECRET: z.string().optional(),
})

function parseEnv() {
  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
    throw new Error('Invalid environment configuration')
  }

  if (parsed.data.NODE_ENV === 'production') {
    const hasR2 = parsed.data.R2_ACCOUNT_ID && parsed.data.R2_ACCESS_KEY_ID && parsed.data.R2_SECRET_ACCESS_KEY && parsed.data.R2_BUCKET_NAME
    const hasS3 = parsed.data.S3_BUCKET && parsed.data.S3_REGION && parsed.data.S3_ACCESS_KEY && parsed.data.S3_SECRET
    if (!hasR2 && !hasS3) {
      throw new Error(
        'Production requires storage config. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME for Cloudflare R2, or S3_BUCKET, S3_REGION, S3_ACCESS_KEY, S3_SECRET for AWS S3.',
      )
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
