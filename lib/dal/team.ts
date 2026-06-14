import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/dal/session'

export type TeamMemberDTO = {
  id: string
  userId: string
  name: string
  email: string
  department: string | null
  assignedClientCount: number
  createdAt: Date
}

export async function listAllTeamMembers(): Promise<TeamMemberDTO[]> {
  await requireRole('SUPER_ADMIN')
  const rows = await prisma.teamMember.findMany({
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { assignments: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    name: r.user.name,
    email: r.user.email,
    department: r.department,
    assignedClientCount: r._count.assignments,
    createdAt: r.createdAt,
  }))
}

export const getTeamMemberDTO = cache(async (teamMemberId: string) => {
  await requireRole('SUPER_ADMIN')
  const r = await prisma.teamMember.findUnique({
    where: { id: teamMemberId },
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
  const admin = await requireRole('SUPER_ADMIN')
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
    userId: admin.id,
    resource: 'User',
    resourceId: created.id,
  })

  return { id: created.teamMember!.id }
}

export async function assignTeamToClient(opts: {
  clientId: string
  teamMemberId: string
}): Promise<void> {
  const admin = await requireRole('SUPER_ADMIN')
  const teamMember = await prisma.teamMember.findUnique({
    where: { id: opts.teamMemberId },
    select: { id: true, userId: true },
  })
  if (!teamMember) throw new Error('Team member not found')

  const client = await prisma.client.findUnique({
    where: { id: opts.clientId },
    select: { id: true, companyName: true },
  })
  if (!client) throw new Error('Client not found')

  await prisma.teamAssignment.upsert({
    where: {
      teamMemberId_clientId: {
        teamMemberId: teamMember.id,
        clientId: client.id,
      },
    },
    create: { teamMemberId: teamMember.id, clientId: client.id },
    update: {}, // no-op if already assigned
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'TEAM_MEMBER_ASSIGNED',
    actorId: admin.id,
    clientId: client.id,
    teamMemberUserId: teamMember.userId,
    companyName: client.companyName,
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'TEAM_MEMBER_ASSIGNED',
    userId: admin.id,
    resource: 'Client',
    resourceId: client.id,
  })
}

export async function unassignTeamFromClient(opts: {
  clientId: string
  teamMemberId: string
}): Promise<void> {
  const admin = await requireRole('SUPER_ADMIN')
  await prisma.teamAssignment.deleteMany({
    where: { clientId: opts.clientId, teamMemberId: opts.teamMemberId },
  })
  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'TEAM_MEMBER_UNASSIGNED',
    userId: admin.id,
    resource: 'Client',
    resourceId: opts.clientId,
  })
}
