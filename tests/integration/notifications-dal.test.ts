// Integration tests for lib/dal/notifications — ownership scoping on
// markRead / markAllRead and the unread counter.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeUser } from '../lib/db'
import { listNotifications, markRead, markAllRead } from '@/lib/dal/notifications'
import { prisma } from '@/lib/db'

beforeEach(async () => {
  await truncateAll()
})
afterEach(() => signOut())

async function seedNotification(recipientId: string) {
  const n = await prisma.notification.create({
    data: {
      recipientId,
      type: 'SUBMISSION_APPROVED',
      title: 'Approved',
      body: 'Your submission was approved',
      href: '/dashboard',
    },
    select: { id: true },
  })
  await prisma.user.update({
    where: { id: recipientId },
    data: { unreadNotifications: { increment: 1 } },
  })
  return n
}

describe('listNotifications', () => {
  it('returns only the recipient’s notifications and counts unread', async () => {
    const alice = await makeUser({ role: 'SUPER_ADMIN' })
    const bob = await makeUser({ role: 'SUPER_ADMIN' })
    await seedNotification(alice.id)
    await seedNotification(alice.id)
    await seedNotification(bob.id)

    await signInAs(alice)
    const res = await listNotifications()
    expect(res.items).toHaveLength(2)
    expect(res.unread).toBe(2)

    await signInAs(bob)
    expect((await listNotifications()).items).toHaveLength(1)
  })
})

describe('markRead ownership', () => {
  it('marks the recipient’s own notification read and decrements unread', async () => {
    const alice = await makeUser({ role: 'SUPER_ADMIN' })
    const n = await seedNotification(alice.id)

    await signInAs(alice)
    await markRead(n.id)
    const row = await prisma.notification.findUnique({ where: { id: n.id } })
    expect(row?.readAt).not.toBeNull()
    expect((await prisma.user.findUnique({ where: { id: alice.id } }))?.unreadNotifications).toBe(0)
  })

  it('ignores an attempt to mark someone else’s notification read', async () => {
    const alice = await makeUser({ role: 'SUPER_ADMIN' })
    const bob = await makeUser({ role: 'SUPER_ADMIN' })
    const bobsNote = await seedNotification(bob.id)

    await signInAs(alice)
    await markRead(bobsNote.id) // recipientId filter → no-op
    const row = await prisma.notification.findUnique({ where: { id: bobsNote.id } })
    expect(row?.readAt).toBeNull() // untouched
    expect((await prisma.user.findUnique({ where: { id: bob.id } }))?.unreadNotifications).toBe(1)
  })
})

describe('markAllRead', () => {
  it('clears all unread for the recipient only', async () => {
    const alice = await makeUser({ role: 'SUPER_ADMIN' })
    const bob = await makeUser({ role: 'SUPER_ADMIN' })
    await seedNotification(alice.id)
    await seedNotification(bob.id)

    await signInAs(alice)
    await markAllRead()
    expect((await prisma.user.findUnique({ where: { id: alice.id } }))?.unreadNotifications).toBe(0)
    expect((await prisma.user.findUnique({ where: { id: bob.id } }))?.unreadNotifications).toBe(1)
  })
})
