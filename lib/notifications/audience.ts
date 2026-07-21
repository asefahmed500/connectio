import 'server-only'
import { prisma } from '@/lib/db'
import type { NotificationEvent } from './types'

// Computes the recipient set for a notification event. The actor is always
// excluded. These rules are the security boundary for visibility — a bug
// here leaks information. Unit tests should cover every case.

export async function computeRecipients(event: NotificationEvent): Promise<string[]> {
  switch (event.type) {
    case 'INVITE_CREATED': {
      // Informational only — audit log is the canonical record. No recipients
      // (the actor is the admin who created it; clients don't have accounts yet).
      return []
    }

    case 'INVITE_CONSUMED': {
      // Notify the admin who created the invite.
      return excludeActor([event.inviteCreatedBy], event.actorId)
    }

    case 'INVITE_EXPIRED': {
      // Notify the admin who created the invite (actor is the cron system).
      return excludeActor([event.inviteCreatedBy], event.actorId)
    }

    case 'SUBMISSION_DRAFTED': {
      // Drafts are private to the client — no notification recipients.
      return []
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
    case 'USER_CREATED':
    case 'DATA_EXPORT_REQUESTED':
    case 'DATA_EXPORT_COMPLETED':
    case 'ERASURE_REQUESTED':
    case 'ERASURE_APPROVED':
    case 'ERASURE_DENIED': {
      return excludeActor([event.targetUserId], event.actorId)
    }

    case 'AUDIT_CHAIN_BROKEN': {
      // Notify all admins about the broken chain
      const admins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      })
      return excludeActor(admins.map((a) => a.id), event.actorId)
    }

    case 'SYSTEM_ERROR': {
      // Notify all admins so they can investigate.
      const admins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      })
      return excludeActor(admins.map((a) => a.id), event.actorId)
    }

    case 'SSO_PROVIDER_CREATED':
    case 'SSO_PROVIDER_UPDATED':
    case 'SSO_PROVIDER_DELETED': {
      // Notify all admins (excluding the actor) for visibility on identity config changes.
      const admins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      })
      return excludeActor(admins.map((a) => a.id), event.actorId)
    }

    case 'SSO_LOGIN_SUCCESS': {
      // Login success — informational only. The actor is the user themselves.
      return []
    }

    case 'SSO_LOGIN_FAILED': {
      // Notify admins so they can spot brute-force attempts or misconfig.
      const admins = await prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' },
        select: { id: true },
      })
      return excludeActor(admins.map((a) => a.id), event.actorId)
    }

    case 'SCIM_USER_PROVISIONED':
    case 'SCIM_USER_DEPROVISIONED': {
      // Notify the affected user (account created / deactivated by their IdP).
      return excludeActor([event.targetUserId], event.actorId)
    }

    case 'FORM_ASSIGNED': {
      // Notify the user who was assigned the form.
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
