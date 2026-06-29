import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireRole, getCurrentUser } from '@/lib/dal/session'
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
  await requireRole('SUPER_ADMIN')
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

export const getUserDTO = cache(async (userId: string) => {
  await requireRole('SUPER_ADMIN')
  const u = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { client: { select: { id: true, companyName: true, uniqueSlug: true } }, teamMember: { select: { id: true, department: true } } },
  })
  if (!u) return null
  return { ...toDTO(u), client: u.client, teamMember: u.teamMember }
})

export async function updateUser(userId: string, input: { name?: string; email?: string; role?: UserRole }): Promise<void> {
  const admin = await requireRole('SUPER_ADMIN')
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
    await tx.user.update({ where: { id: userId }, data: data as any })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({ action: 'USER_UPDATED', userId: admin.id, resource: 'User', resourceId: userId }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({ type: 'USER_UPDATED', actorId: admin.id, targetUserId: userId })
}

export async function toggleBlockUser(userId: string): Promise<{ isActive: boolean }> {
  const admin = await requireRole('SUPER_ADMIN')
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
      userId: admin.id,
      resource: 'User',
      resourceId: userId,
    }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: newIsActive ? 'USER_UNBLOCKED' : 'USER_BLOCKED',
    actorId: admin.id,
    targetUserId: userId,
  })

  return { isActive: newIsActive }
}

export async function adminResetPassword(userId: string): Promise<{ password: string }> {
  const admin = await requireRole('SUPER_ADMIN')
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw new Error('User not found')

  const special = '!@#$%^&*'
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const all = upper + lower + digits + special
  function randPick(s: string) { return s[Math.floor(Math.random() * s.length)] }
  const password = [
    randPick(upper), randPick(lower), randPick(digits), randPick(special),
    ...Array.from({ length: 10 }, () => randPick(all)),
  ].sort(() => Math.random() - 0.5).join('')

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
      userId: admin.id,
      resource: 'User',
      resourceId: userId,
    }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'USER_PASSWORD_RESET_BY_ADMIN',
    actorId: admin.id,
    targetUserId: userId,
  })

  return { password }
}

export async function deleteUser(userId: string): Promise<void> {
  const admin = await requireRole('SUPER_ADMIN')
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user) throw new Error('User not found')

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { deletedAt: new Date() } })
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit({ action: 'USER_DELETED', userId: admin.id, resource: 'User', resourceId: userId }, tx)
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({ type: 'USER_DELETED', actorId: admin.id, targetUserId: userId })
}
