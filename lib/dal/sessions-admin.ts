import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'

export type SessionDTO = {
  id: string
  userId: string
  userName: string
  userEmail: string
  userRole: string
  ip: string | null
  userAgent: string | null
  createdAt: Date
  expiresAt: Date
}

/**
 * Lists active (non-revoked, non-expired) sessions across all users.
 * Admin-only — used by the /admin/sessions page.
 */
export async function listActiveSessions(): Promise<SessionDTO[]> {
  await requirePermission('settings:manage')

  const rows = await prisma.session.findMany({
    where: {
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return rows.map((s) => ({
    id: s.id,
    userId: s.userId,
    userName: s.user.name,
    userEmail: s.user.email,
    userRole: s.user.role,
    ip: s.ip,
    userAgent: s.userAgent,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
  }))
}

/**
 * Force-revoke a single session. Admin-only. Used to kill a specific login
 * (e.g. a compromised account, a forgotten device).
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const admin = await requirePermission('settings:manage')

  await prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SESSION_REVOKED',
    userId: admin.id,
    resource: 'Session',
    resourceId: sessionId,
  })
}

/**
 * Revoke every active session for a user. Admin-only. Useful as part of
 * "force logout everywhere" or incident response.
 */
export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  const admin = await requirePermission('settings:manage')

  const result = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SESSION_BULK_REVOKED',
    userId: admin.id,
    resource: 'User',
    resourceId: userId,
    changes: { after: { count: result.count } },
  })

  return result.count
}
