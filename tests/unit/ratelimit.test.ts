import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'

// Each test runs in the same module instance, so the in-memory buckets
// persist between tests. Clear them via a fresh key prefix per test.

describe('rateLimit (in-memory token bucket)', () => {
  describe('within limit', () => {
    it('allows the first N requests in the window', async () => {
      const key = `test:pass:${Math.random()}`
      for (let i = 0; i < 5; i++) {
        const r = await rateLimit(key, { limit: 5, window: 60 })
        expect(r.ok).toBe(true)
      }
    })

    it('refills over time', async () => {
      const key = `test:refill:${Math.random()}`
      // Drain the bucket.
      for (let i = 0; i < 3; i++) await rateLimit(key, { limit: 3, window: 1 })
      // 6th call should fail (limit reached).
      let r = await rateLimit(key, { limit: 3, window: 1 })
      expect(r.ok).toBe(false)

      // Wait 1.1s for the window to elapse → bucket refills fully.
      await new Promise((resolve) => setTimeout(resolve, 1100))
      r = await rateLimit(key, { limit: 3, window: 1 })
      expect(r.ok).toBe(true)
    })
  })

  describe('over limit', () => {
    it('denies the (N+1)th request', async () => {
      const key = `test:deny:${Math.random()}`
      for (let i = 0; i < 3; i++) await rateLimit(key, { limit: 3, window: 60 })
      const r = await rateLimit(key, { limit: 3, window: 60 })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.retryAfter).toBeGreaterThan(0)
    })

    it('returns a retryAfter hint bounded by the window', async () => {
      const key = `test:retry:${Math.random()}`
      for (let i = 0; i < 2; i++) await rateLimit(key, { limit: 2, window: 30 })
      const r = await rateLimit(key, { limit: 2, window: 30 })
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.retryAfter).toBeLessThanOrEqual(30)
    })
  })

  describe('different keys have independent buckets', () => {
    it('tracks ip:1 and ip:2 separately', async () => {
      const k1 = `test:sep:1:${Math.random()}`
      const k2 = `test:sep:2:${Math.random()}`
      await rateLimit(k1, { limit: 1, window: 60 })
      const r1 = await rateLimit(k1, { limit: 1, window: 60 })
      const r2 = await rateLimit(k2, { limit: 1, window: 60 })
      expect(r1.ok).toBe(false)
      expect(r2.ok).toBe(true)
    })
  })
})

describe('rateLimitAll', () => {
  it('returns success when all checks pass', async () => {
    const k = `test:all:pass:${Math.random()}`
    const r = await rateLimitAll(
      rateLimit(`${k}:1`, { limit: 10, window: 60 }),
      rateLimit(`${k}:2`, { limit: 10, window: 60 }),
    )
    expect(r.ok).toBe(true)
  })

  it('returns the first failure when any check fails', async () => {
    const k = `test:all:fail:${Math.random()}`
    // Pre-drain the second bucket.
    for (let i = 0; i < 5; i++) await rateLimit(`${k}:2`, { limit: 5, window: 60 })

    const r = await rateLimitAll(
      rateLimit(`${k}:1`, { limit: 10, window: 60 }),
      rateLimit(`${k}:2`, { limit: 5, window: 60 }), // will fail
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.retryAfter).toBeGreaterThan(0)
  })
})
