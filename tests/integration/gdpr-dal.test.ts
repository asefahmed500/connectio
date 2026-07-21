// Integration tests for lib/dal/gdpr — the GDPR Art 15 (export) + Art 17 (erasure)
// flows, exercised against connectio_test.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeUser, makeClient } from '../lib/db'
import { prisma } from '@/lib/db'
import {
  exportMyData,
  exportUserDataByAdmin,
  requestErasure,
  listErasureRequests,
  approveErasure,
  denyErasure,
} from '@/lib/dal/gdpr'

beforeEach(async () => {
  await truncateAll()
})
afterEach(() => signOut())

describe('exportMyData (Art 15)', () => {
  it('returns the calling user profile + empty related data for a fresh client', async () => {
    const c = await makeClient()
    await signInAs(c.user)

    const exportResult = await exportMyData()

    expect(exportResult.user.id).toBe(c.user.id)
    expect(exportResult.user.email).toBeDefined()
    expect(exportResult.user.role).toBe('CLIENT')
    expect(exportResult.client).not.toBeNull()
    expect(Array.isArray(exportResult.submissions)).toBe(true)
    expect(Array.isArray(exportResult.comments)).toBe(true)
    expect(Array.isArray(exportResult.files)).toBe(true)
    expect(Array.isArray(exportResult.auditLogs)).toBe(true)
  })

  it('redirects unauthenticated callers (requireSession throws)', async () => {
    // No signInAs — getCurrentUser returns null, requireSession redirects.
    // Redirect is a Next.js internal that throws in tests; we just assert it throws.
    await expect(exportMyData()).rejects.toThrow()
  })
})

describe('exportUserDataByAdmin', () => {
  it('admin can export any user data', async () => {
    const target = await makeClient({ companyName: 'Acme' })
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    const exportResult = await exportUserDataByAdmin(target.user.id)

    expect(exportResult.user.id).toBe(target.user.id)
    expect(exportResult.client).not.toBeNull()
  })

  it('non-admin is denied (requirePermission throws)', async () => {
    const target = await makeClient()
    const otherClient = await makeClient()
    await signInAs(otherClient.user)

    await expect(exportUserDataByAdmin(target.user.id)).rejects.toThrow()
  })

  it('throws NotFoundError for unknown user id', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    await expect(exportUserDataByAdmin('nonexistent-user-id')).rejects.toThrow(/User/)
  })
})

describe('requestErasure (Art 17 — request)', () => {
  it('a client can request erasure for themselves', async () => {
    const c = await makeClient()
    await signInAs(c.user)

    await requestErasure()

    const row = await prisma.erasureRequest.findUnique({ where: { userId: c.user.id } })
    expect(row?.status).toBe('PENDING')
    expect(row?.requestedBy).toBe(c.user.id)
  })

  it('rejects a duplicate pending request', async () => {
    const c = await makeClient()
    await signInAs(c.user)

    await requestErasure()
    await expect(requestErasure()).rejects.toThrow(/already pending/)
  })

  it('allows re-requesting after a prior request was denied', async () => {
    const c = await makeClient()
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(c.user)
    await requestErasure()

    // Admin denies it
    await signInAs(admin)
    const req = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    await denyErasure(req.id, 'not applicable')

    // Client can request again
    await signInAs(c.user)
    await expect(requestErasure()).resolves.toBeUndefined()
    const row = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    expect(row.status).toBe('PENDING')
  })
})

describe('listErasureRequests', () => {
  it('admin sees all requests', async () => {
    const c1 = await makeClient({ companyName: 'A' })
    const c2 = await makeClient({ companyName: 'B' })
    const admin = await makeUser({ role: 'SUPER_ADMIN' })

    await signInAs(c1.user)
    await requestErasure()
    await signInAs(c2.user)
    await requestErasure()

    await signInAs(admin)
    const list = await listErasureRequests()
    expect(list).toHaveLength(2)
    // Most recent first (createdAt desc)
    expect(list[0]!.userName).toBeDefined()
    expect(list[0]!.userEmail).toBeDefined()
  })

  it('non-admin is denied', async () => {
    const c = await makeClient()
    await signInAs(c.user)
    await expect(listErasureRequests()).rejects.toThrow()
  })
})

describe('approveErasure (Art 17 — execute)', () => {
  it('anonymizes user PII, revokes sessions, marks APPROVED, and notifies', async () => {
    const c = await makeClient({ companyName: 'Sensitive Co', contactName: 'Jane Doe' })
    const admin = await makeUser({ role: 'SUPER_ADMIN' })

    await signInAs(c.user)
    await requestErasure()

    await signInAs(admin)
    const req = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    await approveErasure(req.id)

    // User row is anonymized.
    const userRow = await prisma.user.findUniqueOrThrow({ where: { id: c.user.id } })
    expect(userRow.email).toContain('deleted-')
    expect(userRow.email).toContain('@redacted.connectio.test')
    expect(userRow.name).toBe('[Redacted User]')
    expect(userRow.passwordHash).toBe('[REDACTED]')
    expect(userRow.isActive).toBe(false)
    expect(userRow.tokenVersion).toBe(c.user.tokenVersion + 1)
    expect(userRow.anonymizedAt).not.toBeNull()

    // Client row is anonymized.
    const clientRow = await prisma.client.findUniqueOrThrow({ where: { id: c.client.id } })
    expect(clientRow.companyName).toBe('[Redacted Company]')
    expect(clientRow.contactName).toBe('[Redacted Contact]')
    expect(clientRow.uniqueSlug).toContain('redacted-')

    // Request marked APPROVED.
    const reqAfter = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    expect(reqAfter.status).toBe('APPROVED')
    expect(reqAfter.reviewedBy).toBe(admin.id)

    // Audit log records the ADMIN as actor — the variable-shadowing bug
    // (AGENTS.md "Known Issues") would have recorded the victim instead.
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'ERASURE_APPROVED', resourceId: c.user.id },
    })
    expect(audit).not.toBeNull()
    expect(audit!.userId).toBe(admin.id) // ← the bug would fail this assertion

    // Notification emitted.
    const notif = await prisma.notification.findFirst({
      where: { type: 'ERASURE_APPROVED', recipientId: c.user.id },
    })
    expect(notif).not.toBeNull()
  })

  it('non-admin is denied', async () => {
    const c = await makeClient()
    await signInAs(c.user)
    await requestErasure()

    const other = await makeClient()
    await signInAs(other.user)
    const req = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    await expect(approveErasure(req.id)).rejects.toThrow()
  })

  it('throws NotFoundError for unknown request id', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    await expect(approveErasure('nonexistent-req-id')).rejects.toThrow(/ErasureRequest/)
  })

  it('rejects approval of an already-approved request', async () => {
    const c = await makeClient()
    const admin = await makeUser({ role: 'SUPER_ADMIN' })

    await signInAs(c.user)
    await requestErasure()

    await signInAs(admin)
    const req = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    await approveErasure(req.id)

    await expect(approveErasure(req.id)).rejects.toThrow(/not pending/)
  })

  it('can approve erasure for a user with no client row (e.g. team member)', async () => {
    const tm = await makeUser({ role: 'TEAM_MEMBER' })
    const admin = await makeUser({ role: 'SUPER_ADMIN' })

    await signInAs(tm)
    await requestErasure()

    await signInAs(admin)
    const req = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: tm.id } })
    await approveErasure(req.id)

    const userRow = await prisma.user.findUniqueOrThrow({ where: { id: tm.id } })
    expect(userRow.name).toBe('[Redacted User]')
    expect(userRow.isActive).toBe(false)
  })
})

describe('denyErasure', () => {
  it('marks the request DENIED with reason and notifies', async () => {
    const c = await makeClient()
    const admin = await makeUser({ role: 'SUPER_ADMIN' })

    await signInAs(c.user)
    await requestErasure()

    await signInAs(admin)
    const req = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    await denyErasure(req.id, 'not applicable')

    const reqAfter = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    expect(reqAfter.status).toBe('DENIED')
    expect(reqAfter.reason).toBe('not applicable')
    expect(reqAfter.reviewedBy).toBe(admin.id)

    // User is NOT anonymized on denial.
    const userRow = await prisma.user.findUniqueOrThrow({ where: { id: c.user.id } })
    expect(userRow.isActive).toBe(true)
    expect(userRow.name).not.toBe('[Redacted User]')

    // Notification emitted.
    const notif = await prisma.notification.findFirst({
      where: { type: 'ERASURE_DENIED', recipientId: c.user.id },
    })
    expect(notif).not.toBeNull()
  })

  it('rejects denial of an already-decided request', async () => {
    const c = await makeClient()
    const admin = await makeUser({ role: 'SUPER_ADMIN' })

    await signInAs(c.user)
    await requestErasure()

    await signInAs(admin)
    const req = await prisma.erasureRequest.findUniqueOrThrow({ where: { userId: c.user.id } })
    await denyErasure(req.id, 'first denial')

    await expect(denyErasure(req.id, 'second denial')).rejects.toThrow(/not pending/)
  })
})
