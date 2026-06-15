import 'server-only'
import { LocalFsAdapter } from './local-fs'
import { S3Adapter } from './s3'
import type { StorageAdapter } from './adapter'

let cached: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (cached) return cached

  // Cloudflare R2 (S3-compatible) — requires custom endpoint.
  if (
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  ) {
    cached = new S3Adapter({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      bucket: process.env.R2_BUCKET_NAME,
      accessKey: process.env.R2_ACCESS_KEY_ID,
      secret: process.env.R2_SECRET_ACCESS_KEY,
    })
    return cached
  }

  // AWS S3 / S3-compatible (MinIO, DigitalOcean Spaces, etc.)
  if (
    process.env.S3_BUCKET &&
    process.env.S3_REGION &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET
  ) {
    cached = new S3Adapter({
      region: process.env.S3_REGION,
      bucket: process.env.S3_BUCKET,
      accessKey: process.env.S3_ACCESS_KEY,
      secret: process.env.S3_SECRET,
      ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
    })
    return cached
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Storage not configured for production. Set R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_ACCOUNT_ID + R2_BUCKET_NAME for Cloudflare R2, or S3_BUCKET + S3_REGION + S3_ACCESS_KEY + S3_SECRET for AWS S3.',
    )
  }

  const root = process.env.STORAGE_ROOT ?? './storage'
  cached = new LocalFsAdapter({ root })
  return cached
}
