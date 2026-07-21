import 'server-only'
import { cache } from 'react'
import * as nodeCrypto from 'crypto'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import type { UserRole } from '@prisma/client'

export type UserDTO = {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  hasClient: boolean
  hasTeamMember: boolean
}

function toDTO(u: {
  id: string
  email: string
  name: string
  role: UserRole
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  client: { id: string } | null
  teamMember: { id: string } | null
}): UserDTO {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    hasClient: u.client !== null,
    hasTeamMember: u.teamMember !== null,
  }
}

export async function listUsers(params?: PaginationParams & { search?: string; role?: string; status?: string }): Promise<PaginatedResult<UserDTO>> {
  await requirePermission('user:read')
  const { take, skip } = paginationParams(params)

  const where: Record<string, unknown> = { deletedAt: null }
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params?.role) where.role = params.role
  if (params?.status === 'active') where.isActive = true
  if (params?.status === 'blocked') where.isActive = false

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where: where as import('@prisma/client').Prisma.UserWhereInput,
      orderBy: { createdAt: 'desc' },
      include: { client: { select: { id: true } }, teamMember: { select: { id: true } } },
      take,
      skip,
    }),
    prisma.user.count({ where: where as import('@prisma/client').Prisma.UserWhereInput }),
  ])

  return toPaginated(rows.map(toDTO), total, params)
}

export type UserPickerItem = {
  id: string
  name: string
  email: string
  role: string
  hasClient: boolean
}

/**
 * Lightweight user listing for pickers/dropdowns (active users only, no pagination).
 */
export async function listUsersForPicker(): Promise<UserPickerItem[]> {
  await requirePermission('user:read')
  const rows = await prisma.user.findMany({
    where: { deletedAt: null, isActive: true },
    orderBy: { name: 'asc' },
    include: { client: { select: { id: true } } },
  })
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    hasClient: u.client !== null,
  }))
}

export const getUserDTO = cache(async (userId: string) => {
  await requirePermission('user:read')
  const u = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { client: { select: { id: true, companyName: true, uniqueSlug: true } }, teamMember: { select: { id: true, department: true } } },
  })
  if (!u) return null
  return { ...toDTO(u), client: u.client, teamMember: u.teamMember }
})

export async function updateUser(userId: string, input: { name?: string; email?: string; role?: UserRole }): Promise<void> {
  const me = await requirePermission('user:update')
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw new Error('User not found')

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.email !== undefined) data.email = input.email.toLowerCase()
  if (input.role !== undefined) {
    data.role = input.role
    data.tokenVersion = user.tokenVersion + 1
  }

  if (Object.keys(data).length === 0) return

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({ action: 'USER_UPDATED', userId: me.id, resource: 'User', resourceId: userId }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({ type: 'USER_UPDATED', actorId: me.id, targetUserId: userId })
}

export async function toggleBlockUser(userId: string): Promise<{ isActive: boolean }> {
  const me = await requirePermission('user:block')
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw new Error('User not found')

  const newIsActive = !user.isActive

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: newIsActive, tokenVersion: user.tokenVersion + 1 },
    })
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: newIsActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
      userId: me.id,
      resource: 'User',
      resourceId: userId,
    }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: newIsActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
    actorId: me.id,
    targetUserId: userId,
  })

  return { isActive: newIsActive }
}

export async function adminResetPassword(userId: string): Promise<{ password: string }> {
  // DEPRECATED: kept for backward compat with callers/tests, but no longer
  // the preferred path. New code should call adminInitiatePasswordReset()
  // below, which sends the user a self-serve OTP instead of minting a
  // plaintext password that has to be transported over email/state.
  const me = await requirePermission('user:update')
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw new Error('User not found')

  const special = '!@#$%^&*'
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const all = upper + lower + digits + special
  function randPick(s: string) { return s[nodeCrypto.randomInt(0, s.length)] }
  const password = [
    randPick(upper), randPick(lower), randPick(digits), randPick(special),
    ...Array.from({ length: 10 }, () => randPick(all)),
  ].sort(() => nodeCrypto.randomUUID().localeCompare('a')).join('')

  const { hashPassword } = await import('@/lib/auth/password')
  const passwordHash = await hashPassword(password)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, tokenVersion: user.tokenVersion + 1 },
    })
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'USER_PASSWORD_RESET_BY_ADMIN',
      userId: me.id,
      resource: 'User',
      resourceId: userId,
    }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'USER_PASSWORD_RESET_BY_ADMIN',
    actorId: me.id,
    targetUserId: userId,
  })

  return { password }
}

/**
 * Admin-initiated password reset via the existing OTP pipeline.
 *
 * Instead of generating a plaintext password and emailing it (which leaks
 * through email logs, mail relays, shoulder-surfing, and client-side action
 * state), this triggers the same OTP-based reset flow the user would use
 * from /reset-password. The user picks their own password after entering
 * the OTP.
 *
 * Returns the OTP so the caller (server action) can deliver it via email.
 * The OTP is hashed at rest, rate-limited at verification, and expires in
 * 10 minutes.
 */
export async function adminInitiatePasswordReset(userId: string): Promise<{
  email: string
  name: string
  otp: string
}> {
  const me = await requirePermission('user:update')
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, email: true, name: true, tokenVersion: true },
  })
  if (!user) throw new Error('User not found')

  // Revoke sessions immediately so the user can't stay logged in past the
  // admin-triggered reset.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { tokenVersion: user.tokenVersion + 1 },
    })
    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit(
      {
        action: 'USER_PASSWORD_RESET_BY_ADMIN',
        userId: me.id,
        resource: 'User',
        resourceId: userId,
      },
      tx,
    )
  })

  // Generate and persist a 6-digit OTP via the shared pipeline.
  const { createPasswordResetOtp } = await import('@/lib/dal/password-reset')
  const result = await createPasswordResetOtp(user.email)
  if (!result.userExists || !result.rawOtp) {
    // Should not happen — we just confirmed the user exists above.
    throw new Error('Could not issue password-reset OTP')
  }

  return { email: user.email, name: user.name, otp: result.rawOtp }
}

export async function deleteUser(userId: string): Promise<void> {
  const me = await requirePermission('user:delete')
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw new Error('User not found')

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({ action: 'USER_DELETED', userId: me.id, resource: 'User', resourceId: userId }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({ type: 'USER_DELETED', actorId: me.id, targetUserId: userId })
}

export async function bulkToggleBlockUser(userIds: string[]): Promise<{ affected: number }> {
  const me = await requirePermission('user:block')
  if (userIds.length === 0) return { affected: 0 }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true, isActive: true, tokenVersion: true },
  })
  if (users.length === 0) return { affected: 0 }

  // Determine target state: if any are blocked, unblock all; otherwise block all
  const anyBlocked = users.some((u) => !u.isActive)
  const targetActive = anyBlocked

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: {
        isActive: targetActive,
        tokenVersion: { increment: 1 },
      },
    })
    await tx.session.updateMany({
      where: { userId: { in: users.map((u) => u.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: targetActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
      userId: me.id,
      resource: 'User',
      resourceId: users.length === 1 ? users[0]!.id : `${users.length} users`,
    }, tx)
  })

  return { affected: users.length }
}

export async function bulkDeleteUser(userIds: string[]): Promise<{ affected: number }> {
  const me = await requirePermission('user:delete')
  if (userIds.length === 0) return { affected: 0 }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    select: { id: true },
  })
  if (users.length === 0) return { affected: 0 }

  await prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { id: { in: users.map((u) => u.id) } },
      data: { deletedAt: new Date() },
    })
    await tx.session.updateMany({
      where: { userId: { in: users.map((u) => u.id) }, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({
      action: 'USER_DELETED',
      userId: me.id,
      resource: 'User',
      resourceId: users.length === 1 ? users[0]!.id : `${users.length} users`,
    }, tx)
  })

  return { affected: users.length }
}
