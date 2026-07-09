import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeUser } from '../lib/db'
import { prisma } from '@/lib/db'
import {
  beginTwoFactorEnrollment,
  completeTwoFactorEnrollment,
  disableTwoFactor,
  getTwoFactorStatus,
} from '@/lib/dal/two-factor'
import { verifyTotp } from '@/lib/auth/totp'
import { createHmac } from 'crypto'

function totpCode(secret: string): string {
  const counter = Math.floor(Date.now() / 30000)
  return hotpBase32(secret, counter)
}

function hotpBase32(secret: string, counter: number): string {
  const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  function b32decode(s: string): Buffer {
    const clean = s.replace(/=+$/, '').toUpperCase()
    let bits = 0, value = 0
    const bytes: number[] = []
    for (const char of clean) {
      const idx = BASE32.indexOf(char)
      if (idx === -1) continue
      value = (value << 5) | idx
      bits += 5
      if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 0xff); bits -= 8 }
    }
    return Buffer.from(bytes)
  }
  const key = b32decode(secret)
  const buf = Buffer.alloc(8)
  let c = counter
  for (let i = 7; i >= 0; i--) { buf[i] = c & 0xff; c = Math.floor(c / 256) }
  const hmac = createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1]! & 0xf
  const code = ((hmac[offset]! & 0x7f) << 24) | ((hmac[offset + 1]! & 0xff) << 16) | ((hmac[offset + 2]! & 0xff) << 8) | (hmac[offset + 3]! & 0xff)
  return (code % 1000000).toString().padStart(6, '0')
}

describe('two-factor DAL', () => {
  beforeEach(async () => { await truncateAll() })
  afterEach(async () => { await signOut() })

  describe('getTwoFactorStatus', () => {
    it('returns disabled for a fresh user', async () => {
      const u = await makeUser({ role: 'CLIENT' })
      await signInAs(u)
      const s = await getTwoFactorStatus()
      expect(s.enabled).toBe(false)
      expect(s.pending).toBe(false)
    })
  })

  describe('enrollment flow', () => {
    it('begin → stores a pending secret', async () => {
      const u = await makeUser({ role: 'CLIENT' })
      await signInAs(u)
      const { secret, uri } = await beginTwoFactorEnrollment()
      expect(secret).toMatch(/^[A-Z2-7]+/)
      expect(uri).toContain('otpauth://totp/')

      const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } })
      expect(row.totpPendingSecret).toBeTruthy()
    })

    it('rejects an obviously wrong code', async () => {
      const u = await makeUser({ role: 'CLIENT' })
      await signInAs(u)
      await beginTwoFactorEnrollment()
      await expect(completeTwoFactorEnrollment('000000')).rejects.toThrow('Invalid code')
    })

    it('full enrollment: begin → verify → complete → enabled', async () => {
      const u = await makeUser({ role: 'CLIENT' })
      await signInAs(u)

      const { secret } = await beginTwoFactorEnrollment()

      const code = totpCode(secret)
      expect(verifyTotp(secret, code)).toBe(true)

      const result = await completeTwoFactorEnrollment(code)
      expect(result.backupCodes).toHaveLength(10)

      const status = await getTwoFactorStatus()
      expect(status.enabled).toBe(true)
    })
  })

  describe('disableTwoFactor (with re-auth)', () => {
    it('rejects a wrong password', async () => {
      const u = await makeUser({ role: 'CLIENT', password: 'CorrectH0rse!' })
      await signInAs(u)

      await beginTwoFactorEnrollment()
      const secret = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).totpPendingSecret!
      await completeTwoFactorEnrollment(totpCode(secret))

      await expect(disableTwoFactor('WrongPassword!')).rejects.toThrow()
    })

    it('succeeds with correct password', async () => {
      const u = await makeUser({ role: 'CLIENT', password: 'CorrectH0rse!' })
      await signInAs(u)

      await beginTwoFactorEnrollment()
      const secret = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).totpPendingSecret!
      await completeTwoFactorEnrollment(totpCode(secret))

      await disableTwoFactor('CorrectH0rse!')

      const status = await getTwoFactorStatus()
      expect(status.enabled).toBe(false)
    })
  })
})
