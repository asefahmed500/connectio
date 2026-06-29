import 'server-only'
import { prisma } from '@/lib/db'
import type { NotificationEvent } from './types'

// Computes the recipient set for a notification event. The actor is always
// excluded. These rules are the security boundary for visibility — a bug
// here leaks information. Unit tests should cover every case.

export async function computeRecipients(event: NotificationEvent): Promise<string[]> {
  switch (event.type) {
    case 'INVITE_CONSUMED': {
      // Notify the admin who created the invite.
      return excludeActor([event.inviteCreatedBy], event.actorId)
    }

    case 'SUBMISSION_SUBMITTED':
    case 'FILE_UPLOADED_CLIENT': {
      // All admins + assigned team members.
      return excludeActor(await listAdminsAndAssignedTeam(event.clientId), event.actorId)
    }

    case 'SUBMISSION_IN_REVIEW':
    case 'SUBMISSION_CHANGES_REQUESTED':
    case 'SUBMISSION_APPROVED':
    case 'SUBMISSION_REJECTED': {
      // Notify the client.
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: event.clientId },
        select: { userId: true },
      })
      return excludeActor([client.userId], event.actorId)
    }

    case 'COMMENT_POSTED_EXTERNAL': {
      // External comment by team/admin → notify the client.
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: event.clientId },
        select: { userId: true },
      })
      return excludeActor([client.userId], event.actorId)
    }

    case 'COMMENT_POSTED_EXTERNAL_BY_CLIENT':
    case 'COMMENT_POSTED_INTERNAL': {
      // Client posted (external) or team/admin posted (internal) → admins + assigned team.
      return excludeActor(await listAdminsAndAssignedTeam(event.clientId), event.actorId)
    }

    case 'COMMENT_REPLY': {
      return excludeActor([event.parentAuthorId], event.actorId)
    }

    case 'FILE_UPLOADED_TEAM': {
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: event.clientId },
        select: { userId: true },
      })
      return excludeActor([client.userId], event.actorId)
    }

    case 'TEAM_MEMBER_ASSIGNED': {
      return excludeActor([event.teamMemberUserId], event.actorId)
    }

    case 'USER_UPDATED':
    case 'USER_BLOCKED':
    case 'USER_UNBLOCKED':
    case 'USER_DELETED':
    case 'USER_PASSWORD_RESET_BY_ADMIN':
    case 'USER_CREATED': {
      return excludeActor([event.targetUserId], event.actorId)
    }
  }
}

async function listAdminsAndAssignedTeam(clientId: string): Promise<string[]> {
  const [admins, assigned] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    }),
    prisma.teamAssignment.findMany({
      where: { clientId },
      include: { teamMember: { select: { userId: true } } },
    }),
  ])
  return [...admins.map((a) => a.id), ...assigned.map((a) => a.teamMember.userId)]
}

function excludeActor(userIds: string[], actorId: string): string[] {
  const filtered = userIds.filter((id) => id !== actorId)
  return Array.from(new Set(filtered))
}
