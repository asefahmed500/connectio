import 'server-only'
import { LocalFsAdapter } from './local-fs'
import type { StorageAdapter } from './adapter'

// Pick adapter by environment. S3 adapter is added in the production-deploy
// milestone; for now everything goes through the local FS adapter (works in
// dev and self-host; Vercel will need either the S3 adapter or Vercel Blob).

let cached: StorageAdapter | null = null

export function getStorage(): StorageAdapter {
  if (cached) return cached

  if (process.env.NODE_ENV === 'production' && process.env.S3_BUCKET) {
    // Placeholder — wire S3Adapter here when production deploy lands.
    // (Avoids a half-finished S3 implementation that gives false confidence.)
    throw new Error(
      'S3 storage adapter not configured. Set up lib/storage/s3.ts before deploying to production.',
    )
  }

  const root = process.env.STORAGE_ROOT ?? './storage'
  cached = new LocalFsAdapter({ root })
  return cached
}
