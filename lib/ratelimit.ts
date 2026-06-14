import 'server-only'

// In-memory token-bucket rate limiter. Sufficient for development and single-instance deploys.
// Production should swap this for Upstash Redis (REVIEW-3.md §3.5). The public API
// (rateLimit) stays identical so the swap is one file.

interface Bucket {
  tokens: number
  lastRefill: number
}

const buckets = new Map<string, Bucket>()

const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  // Drop buckets that have fully refilled (i.e. are at capacity) — they're stale.
  for (const [key, b] of buckets) {
    if (b.tokens >= 1000) buckets.delete(key)
  }
}

export interface RateBucket {
  /** Maximum tokens the bucket holds. */
  limit: number
  /** Window in seconds for full refill. */
  window: number
}

/**
 * Returns true if the request is allowed; false if rate-limited.
 *
 * Pass a stable key like `login:ip:<ip>` or `login:email:<email>`.
 * The same key shares a bucket across calls within the window.
 */
export async function rateLimit(
  key: string,
  bucket: RateBucket,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const now = Date.now()
  cleanup(now)

  const refillRate = bucket.limit / (bucket.window * 1000) // tokens per ms
  const existing = buckets.get(key)

  let b: Bucket
  if (existing) {
    const elapsed = now - existing.lastRefill
    const refilled = Math.min(bucket.limit, existing.tokens + elapsed * refillRate)
    b = { tokens: refilled, lastRefill: now }
  } else {
    b = { tokens: bucket.limit, lastRefill: now }
  }

  if (b.tokens < 1) {
    const secondsToWait = Math.ceil((1 - b.tokens) / refillRate / 1000)
    buckets.set(key, b)
    return { ok: false, retryAfter: Math.min(secondsToWait, bucket.window) }
  }

  b.tokens -= 1
  buckets.set(key, b)
  return { ok: true }
}

/** Combine multiple rate-limit checks; returns the first failure or success if all pass. */
export async function rateLimitAll(
  ...checks: Array<Promise<{ ok: true } | { ok: false; retryAfter: number }>>
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const results = await Promise.all(checks)
  return results.find((r) => !r.ok) ?? { ok: true }
}
