import 'server-only'

// Hybrid rate limiter: Upstash Redis when configured, in-memory token bucket as fallback.
// The public API (rateLimit, rateLimitAll) stays identical regardless of backend.

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
  for (const [key, b] of buckets) {
    if (b.tokens >= 1000) buckets.delete(key)
  }
}

// ── Redis (Upstash REST API) ─────────────────────────────────────

function redisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function redisIncr(key: string, windowSeconds: number): Promise<number> {
  const url = process.env.UPSTASH_REDIS_REST_URL!
  const res = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}` },
  })
  const data = (await res.json()) as { result: number }
  // Set expiry on first create (INCR returns 1)
  if (data.result === 1) {
    await fetch(`${url}/expire/${encodeURIComponent(key)}/${windowSeconds}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN!}` },
    })
  }
  return data.result
}

async function redisRateLimit(
  key: string,
  bucket: RateBucket,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const windowKey = `rl:${key}:${Math.floor(Date.now() / (bucket.window * 1000))}`
  try {
    const count = await redisIncr(windowKey, bucket.window)
    if (count > bucket.limit) {
      return { ok: false, retryAfter: bucket.window }
    }
    return { ok: true }
  } catch {
    // Redis down — fall through to in-memory
  }
  return inMemoryRateLimit(key, bucket)
}

// ── In-memory token bucket ──────────────────────────────────────

async function inMemoryRateLimit(
  key: string,
  bucket: RateBucket,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const now = Date.now()
  cleanup(now)

  const refillRate = bucket.limit / (bucket.window * 1000)
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

// ── Public API ──────────────────────────────────────────────────

export interface RateBucket {
  limit: number
  window: number
}

export async function rateLimit(
  key: string,
  bucket: RateBucket,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  if (redisConfigured()) {
    return redisRateLimit(key, bucket)
  }
  return inMemoryRateLimit(key, bucket)
}

export async function rateLimitAll(
  ...checks: Array<Promise<{ ok: true } | { ok: false; retryAfter: number }>>
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const results = await Promise.all(checks)
  return results.find((r) => !r.ok) ?? { ok: true }
}
