// Integration tests for lib/dal/password-reset — token issuance, redemption,
// single-use enforcement, and session invalidation on reset.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { truncateAll, makeUser } from '../lib/db'
import { prisma } from '@/lib/db'
import {
  createPasswordResetToken,
  resetPassword,
  verifyResetToken,
} from '@/lib/dal/password-reset'

beforeEach(async () => {
  await truncateAll()
})

describe('createPasswordResetToken', () => {
  it('issues a token for a known user', async () => {
    const u = await makeUser({ role: 'CLIENT' })
    const token = await createPasswordResetToken(u.email)
    expect(token).toBeTruthy()
    const records = await prisma.passwordResetToken.findMany({ where: { userId: u.id } })
    expect(records).toHaveLength(1)
  })

  it('returns null for an unknown email (no enumeration)', async () => {
    expect(await createPasswordResetToken('nobody@test.local')).toBeNull()
  })

  it('replaces a prior unused token (one active reset at a time)', async () => {
    const u = await makeUser({ role: 'CLIENT' })
    await createPasswordResetToken(u.email)
    await createPasswordResetToken(u.email)
    const records = await prisma.passwordResetToken.findMany({ where: { userId: u.id } })
    expect(records).toHaveLength(1)
  })
})

describe('resetPassword', () => {
  it('resets the password, bumps tokenVersion, and marks the token used', async () => {
    const u = await makeUser({ role: 'CLIENT', tokenVersion: 3 })
    const token = await createPasswordResetToken(u.email)
    const before = await prisma.user.findUnique({ where: { id: u.id } })

    const res = await resetPassword({ token: token!, newPassword: 'BrandNew!2026' })
    expect(res.ok).toBe(true)

    const after = await prisma.user.findUnique({ where: { id: u.id } })
    expect(after?.passwordHash).not.toBe(before?.passwordHash)
    expect(after?.tokenVersion).toBe(4) // bumped → invalidates existing sessions
    const used = await prisma.passwordResetToken.findFirst({ where: { userId: u.id } })
    expect(used?.usedAt).not.toBeNull()
  })

  it('rejects a second use of the same token', async () => {
    const u = await makeUser({ role: 'CLIENT' })
    const token = await createPasswordResetToken(u.email)
    await resetPassword({ token: token!, newPassword: 'BrandNew!2026' })
    const second = await resetPassword({ token: token!, newPassword: 'Another!2026' })
    expect(second.ok).toBe(false)
  })

  it('rejects a bogus token', async () => {
    const res = await resetPassword({ token: 'totally-bogus', newPassword: 'X!2026aaaa' })
    expect(res.ok).toBe(false)
  })
})

describe('verifyResetToken', () => {
  it('is true before use, false after', async () => {
    const u = await makeUser({ role: 'CLIENT' })
    const token = await createPasswordResetToken(u.email)
    expect(await verifyResetToken(token!)).toBe(true)
    await resetPassword({ token: token!, newPassword: 'BrandNew!2026' })
    expect(await verifyResetToken(token!)).toBe(false)
  })
})
