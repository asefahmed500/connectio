import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { getCurrentUser, requireClientAccess } from '@/lib/dal/session'
import { requirePermission } from '@/lib/auth/permissions'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import type { Prisma } from '@prisma/client'

export type TeamMemberDTO = {
  id: string
  userId: string
  name: string
  email: string
  department: string | null
  assignedClientCount: number
  createdAt: Date
}

export type TeamListParams = PaginationParams & {
  search?: string
}

export async function listAllTeamMembers(params?: TeamListParams): Promise<PaginatedResult<TeamMemberDTO>> {
  await requirePermission('team:read')
  const { take, skip } = paginationParams(params)

  const where: Prisma.TeamMemberWhereInput = { deletedAt: null }
  if (params?.search) {
    where.user = {
      OR: [
        { name: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ],
    }
  }

  const [rows, total] = await Promise.all([
    prisma.teamMember.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.teamMember.count({ where }),
  ])

  const items = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.user.name,
    email: r.user.email,
    department: r.department,
    assignedClientCount: r._count.assignments,
    createdAt: r.createdAt,
  }))

  return toPaginated(items, total, params)
}

export const getTeamMemberDTO = cache(async (teamMemberId: string) => {
  await requirePermission('team:read')
  const r = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, deletedAt: null },
    include: {
      user: { select: { name: true, email: true } },
      assignments: { include: { client: { select: { id: true, companyName: true, uniqueSlug: true } } } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    userId: r.userId,
    name: r.user.name,
    email: r.user.email,
    department: r.department,
    assignments: r.assignments.map((a) => ({
      id: a.client.id,
      companyName: a.client.companyName,
      uniqueSlug: a.client.uniqueSlug,
    })),
  }
})

/**
 * Check whether an email is already registered (case-insensitive).
 * Used by the create-team-member flow before calling createTeamMember,
 * so the action can surface a user-friendly message instead of relying
 * on Prisma's unique-constraint exception.
 */
export async function checkEmailTaken(email: string): Promise<boolean> {
  await requirePermission('team:manage')
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  })
  return existing !== null
}

/**
 * Create a team member from an existing user (admin promotes a known user) OR
 * create a brand-new user. We pick the latter for the v1 admin flow: admin
 * enters name/email/temporary password, account is created as TEAM_MEMBER.
 */
export async function createTeamMember(input: {
  name: string
  email: string
  password: string
  department?: string
}): Promise<{ id: string }> {
  const user = await requirePermission('team:manage')
  const { hashPassword } = await import('@/lib/auth/password')

  // Hash OUTSIDE the create() — argon2 is slow (~80ms) and we don't want to
  // hold a Postgres transaction open during it.
  const passwordHash = await hashPassword(input.password)

  const created = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: 'TEAM_MEMBER',
      teamMember: {
        create: { department: input.department ?? null },
      },
    },
    include: { teamMember: true },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'TEAM_MEMBER_CREATED',
    userId: user.id,
    resource: 'User',
    resourceId: created.id,
  })

  return { id: created.teamMember!.id }
}

export async function assignTeamToClient(opts: {
  clientId: string
  teamMemberId: string
}): Promise<void> {
  const user = await requirePermission('team:manage')
  const teamMember = await prisma.teamMember.findFirst({
    where: { id: opts.teamMemberId, deletedAt: null },
    select: { id: true, userId: true },
  })
  if (!teamMember) throw new Error('Team member not found')

  const client = await prisma.client.findFirst({
    where: { id: opts.clientId, deletedAt: null },
    select: { id: true, companyName: true },
  })
  if (!client) throw new Error('Client not found')

  const alreadyAssigned = await prisma.teamAssignment.findUnique({
    where: {
      teamMemberId_clientId: {
        teamMemberId: teamMember.id,
        clientId: client.id,
      },
    },
  })
  if (alreadyAssigned) return

  await prisma.teamAssignment.create({
    data: { teamMemberId: teamMember.id, clientId: client.id },
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'TEAM_MEMBER_ASSIGNED',
    actorId: user.id,
    clientId: client.id,
    teamMemberUserId: teamMember.userId,
    companyName: client.companyName,
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'TEAM_MEMBER_ASSIGNED',
    userId: user.id,
    resource: 'Client',
    resourceId: client.id,
  })
}

export type TeamAssignmentDTO = {
  id: string
  clientId: string
  companyName: string
  uniqueSlug: string
  contactName: string
  submissionsCount: number
  commentsCount: number
  filesCount: number
}

export async function listTeamAssignments(teamMemberId: string): Promise<TeamAssignmentDTO[]> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  // TEAM_MEMBER can only see their own assignments; SUPER_ADMIN can see any.
  if (user.role === 'TEAM_MEMBER') {
    const tm = await prisma.teamMember.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    })
    if (!tm || tm.id !== teamMemberId) throw new Error('Forbidden')
  } else if (user.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden')
  }

  const rows = await prisma.teamAssignment.findMany({
    where: { teamMemberId },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          uniqueSlug: true,
          contactName: true,
          _count: {
            select: {
              submissions: { where: { deletedAt: null } },
              comments: { where: { deletedAt: null } },
              files: { where: { deletedAt: null } },
            },
          },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  })

  return rows.map((a) => ({
    id: a.id,
    clientId: a.client.id,
    companyName: a.client.companyName,
    uniqueSlug: a.client.uniqueSlug,
    contactName: a.client.contactName,
    submissionsCount: a.client._count.submissions,
    commentsCount: a.client._count.comments,
    filesCount: a.client._count.files,
  }))
}

export async function listAssignedTeamMembers(clientId: string): Promise<{ id: string; teamMemberId: string; name: string; email: string; department: string | null }[]> {
  await requireClientAccess(clientId)
  const rows = await prisma.teamAssignment.findMany({
    where: { clientId },
    include: {
      teamMember: {
        include: {
          user: { select: { name: true, email: true } },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  })
  return rows.map((a) => ({
    id: a.id,
    teamMemberId: a.teamMember.id,
    name: a.teamMember.user.name,
    email: a.teamMember.user.email,
    department: a.teamMember.department,
  }))
}

export async function listUnassignedTeamMembers(clientId: string): Promise<{ id: string; name: string; email: string }[]> {
  await requirePermission('team:manage')
  const rows = await prisma.teamMember.findMany({
    where: {
      deletedAt: null,
      assignments: { none: { clientId } },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true, email: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    name: r.user.name,
    email: r.user.email,
  }))
}

export async function listUnassignedClients(teamMemberId: string): Promise<{ id: string; companyName: string; uniqueSlug: string }[]> {
  await requirePermission('team:manage')
  return prisma.client.findMany({
    where: { deletedAt: null, assignments: { none: { teamMemberId } } },
    orderBy: { companyName: 'asc' },
    select: { id: true, companyName: true, uniqueSlug: true },
  })
}

export async function unassignTeamFromClient(opts: {
  clientId: string
  teamMemberId: string
}): Promise<void> {
  const user = await requirePermission('team:manage')
  await prisma.teamAssignment.deleteMany({
    where: { clientId: opts.clientId, teamMemberId: opts.teamMemberId },
  })
  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'TEAM_MEMBER_UNASSIGNED',
    userId: user.id,
    resource: 'Client',
    resourceId: opts.clientId,
  })
}
