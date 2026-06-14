import 'server-only'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/dal/session'
import type { NotificationDTO } from '@/lib/notifications/types'

function toDTO(n: {
  id: string
  type: import('@prisma/client').NotificationType
  title: string
  body: string
  href: string
  readAt: Date | null
  createdAt: Date
}): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    href: n.href,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }
}

export async function listNotifications(opts: { limit?: number } = {}): Promise<{
  items: NotificationDTO[]
  unread: number
}> {
  const user = await getCurrentUser()
  if (!user) return { items: [], unread: 0 }

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { recipientId: user.id },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 30,
    }),
    prisma.notification.count({
      where: { recipientId: user.id, readAt: null },
    }),
  ])

  return { items: rows.map(toDTO), unread: unreadCount }
}

export async function listNotificationsSince(since: Date): Promise<NotificationDTO[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const rows = await prisma.notification.findMany({
    where: { recipientId: user.id, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
  })
  return rows.map(toDTO)
}

export async function markRead(notificationId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  // Atomically: set readAt if not already set, AND decrement unread if we did.
  // Wrapped in a transaction so the count never drifts.
  await prisma.$transaction(async (tx) => {
    const updated = await tx.notification.updateMany({
      where: { id: notificationId, recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
    if (updated.count > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { unreadNotifications: { decrement: 1 } },
      })
    }
  })
}

export async function markAllRead(): Promise<void> {
  const user = await getCurrentUser()
  if (!user) return

  await prisma.$transaction(async (tx) => {
    const result = await tx.notification.updateMany({
      where: { recipientId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
    if (result.count > 0) {
      await tx.user.update({
        where: { id: user.id },
        data: { unreadNotifications: 0 },
      })
    }
  })
}
