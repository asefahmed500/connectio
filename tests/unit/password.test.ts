import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('password', () => {
  describe('hashPassword', () => {
    it('produces an argon2id-encoded hash', async () => {
      const hash = await hashPassword('correct horse battery staple')
      expect(hash.startsWith('$argon2id$')).toBe(true)
    })

    it('produces unique hashes for the same input (random salt)', async () => {
      const a = await hashPassword('same-password-123')
      const b = await hashPassword('same-password-123')
      expect(a).not.toBe(b)
    })
  })

  describe('verifyPassword', () => {
    it('accepts the correct password', async () => {
      const hash = await hashPassword('hunter2-hunter2!')
      expect(await verifyPassword(hash, 'hunter2-hunter2!')).toBe(true)
    })

    it('rejects the wrong password', async () => {
      const hash = await hashPassword('hunter2-hunter2!')
      expect(await verifyPassword(hash, 'wrong')).toBe(false)
    })

    // REVIEW.md §2.1 — no user-existence oracle via timing.
    // When the caller passes null (no user found), verifyPassword still runs
    // against a dummy hash so the response time is the same as a real miss.
    it('runs against a dummy hash when storedHash is null (constant-time miss)', async () => {
      const realHash = await hashPassword('whatever-12345')
      const nullStart = Date.now()
      await verifyPassword(null, 'wrong-password')
      const nullDuration = Date.now() - nullStart

      const realStart = Date.now()
      await verifyPassword(realHash, 'wrong-password')
      const realDuration = Date.now() - realStart

      // Both should take non-trivial time (argon2 is deliberately slow).
      // We don't assert exact equality — timing varies — but both should be
      // measurably slow, proving the dummy hash actually ran.
      expect(nullDuration).toBeGreaterThan(10)
      expect(realDuration).toBeGreaterThan(10)
      expect(await verifyPassword(null, 'wrong-password')).toBe(false)
    })

    it('returns false (not throw) on a malformed stored hash', async () => {
      expect(await verifyPassword('not-a-real-hash', 'anything')).toBe(false)
    })
  })
})
