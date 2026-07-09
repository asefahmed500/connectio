import 'server-only'
import { prisma } from '@/lib/db'
import { requireSession, getCurrentUser } from '@/lib/dal/session'
import { requirePermission } from '@/lib/auth/permissions'
import { NotFoundError, ForbiddenError } from '@/lib/errors'
import type { ErasureStatus } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────
// Data Subject Access Request (GDPR Art 15) — export all user data
// ─────────────────────────────────────────────────────────────────────

export type UserDataExport = {
  user: {
    id: string
    email: string
    name: string
    role: string
    isActive: boolean
    lastLoginAt: Date | null
    createdAt: Date
  }
  client: Record<string, unknown> | null
  submissions: Record<string, unknown>[]
  comments: Record<string, unknown>[]
  files: Record<string, unknown>[]
  auditLogs: Record<string, unknown>[]
}

export async function exportMyData(): Promise<UserDataExport> {
  const currentUser = await requireSession()

  const [userRow, clientRow, submissions, comments, files, auditLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { lastLoginAt: true, createdAt: true },
    }),
    prisma.client.findFirst({
      where: { userId: currentUser.id, deletedAt: null },
    }),
    prisma.submission.findMany({
      where: { client: { userId: currentUser.id }, deletedAt: null },
      include: { form: { select: { title: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.comment.findMany({
      where: { authorId: currentUser.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.file.findMany({
      where: { uploadedById: currentUser.id, deletedAt: null },
      orderBy: { uploadedAt: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { userId: currentUser.id },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    user: {
      id: currentUser.id,
      email: currentUser.email,
      name: currentUser.name,
      role: currentUser.role,
      isActive: currentUser.isActive,
      lastLoginAt: userRow?.lastLoginAt ?? null,
      createdAt: userRow?.createdAt ?? new Date(),
    },
    client: clientRow as Record<string, unknown> | null,
    submissions: submissions.map((s) => ({
      id: s.id,
      formTitle: s.form.title,
      status: s.status,
      formData: s.formData,
      submittedAt: s.submittedAt,
      createdAt: s.createdAt,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      message: c.message,
      isInternal: c.isInternal,
      createdAt: c.createdAt,
    })),
    files: files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: Number(f.size),
      uploadedAt: f.uploadedAt,
    })),
    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      resource: a.resource,
      resourceId: a.resourceId,
      createdAt: a.createdAt,
    })),
  }
}

export async function exportUserDataByAdmin(userId: string): Promise<UserDataExport> {
  await requirePermission('gdpr:manage')
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) throw new NotFoundError('User')

  const [clientRow, submissions, comments, files, auditLogs] = await Promise.all([
    prisma.client.findFirst({
      where: { userId: user.id, deletedAt: null },
    }),
    prisma.submission.findMany({
      where: { client: { userId: user.id }, deletedAt: null },
      include: { form: { select: { title: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.comment.findMany({
      where: { authorId: user.id, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.file.findMany({
      where: { uploadedById: user.id, deletedAt: null },
      orderBy: { uploadedAt: 'asc' },
    }),
    prisma.auditLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    },
    client: clientRow as Record<string, unknown> | null,
    submissions: submissions.map((s) => ({
      id: s.id,
      formTitle: s.form.title,
      status: s.status,
      formData: s.formData,
      submittedAt: s.submittedAt,
      createdAt: s.createdAt,
    })),
    comments: comments.map((c) => ({
      id: c.id,
      clientId: c.clientId,
      message: c.message,
      isInternal: c.isInternal,
      createdAt: c.createdAt,
    })),
    files: files.map((f) => ({
      id: f.id,
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: Number(f.size),
      uploadedAt: f.uploadedAt,
    })),
    auditLogs: auditLogs.map((a) => ({
      id: a.id,
      action: a.action,
      resource: a.resource,
      resourceId: a.resourceId,
      createdAt: a.createdAt,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────
// Right to Erasure (GDPR Art 17)
// ─────────────────────────────────────────────────────────────────────

export async function requestErasure(): Promise<void> {
  const user = await requireSession()

  const existing = await prisma.erasureRequest.findUnique({
    where: { userId: user.id },
  })
  if (existing && existing.status === 'PENDING') {
    throw new Error('An erasure request is already pending')
  }

  await prisma.erasureRequest.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      requestedBy: user.id,
      status: 'PENDING',
    },
    update: { status: 'PENDING', reviewedBy: null, reviewedAt: null },
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'ERASURE_REQUESTED',
    actorId: user.id,
    targetUserId: user.id,
  })
}

export async function listErasureRequests(): Promise<
  {
    id: string
    userId: string
    userEmail: string
    userName: string
    reason: string | null
    status: ErasureStatus
    requestedBy: string
    createdAt: Date
  }[]
> {
  await requirePermission('gdpr:manage')

  const rows = await prisma.erasureRequest.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true, name: true } } },
  })

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    userEmail: r.user.email,
    userName: r.user.name,
    reason: r.reason,
    status: r.status,
    requestedBy: r.requestedBy,
    createdAt: r.createdAt,
  }))
}

export async function approveErasure(requestId: string): Promise<void> {
  const user = await requirePermission('gdpr:manage')

  const request = await prisma.erasureRequest.findUnique({
    where: { id: requestId },
  })
  if (!request) throw new NotFoundError('ErasureRequest')
  if (request.status !== 'PENDING') {
    throw new Error('Erasure request is not pending')
  }

  await prisma.$transaction(async (tx) => {
    // Fetch full user with relations
    const user = await tx.user.findUnique({
      where: { id: request.userId },
      include: { client: true },
    })
    if (!user) throw new NotFoundError('User')

    // Anonymize user PII
    const anonymizedEmail = `deleted-${user.id.slice(0, 8)}@redacted.connectio.test`
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: anonymizedEmail,
        name: '[Redacted User]',
        passwordHash: '[REDACTED]',
        isActive: false,
        tokenVersion: { increment: 1 },
        anonymizedAt: new Date(),
      },
    })

    // Revoke all sessions
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })

    // Anonymize client PII if exists
    if (user.client) {
      await tx.client.update({
        where: { id: user.client.id },
        data: {
          companyName: '[Redacted Company]',
          contactName: '[Redacted Contact]',
          uniqueSlug: `redacted-${user.client.id.slice(0, 8)}`,
          projectBrief: null,
          budget: null,
          timeline: null,
        },
      })
    }

    // Mark the erasure request as approved
    await tx.erasureRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    })

    // Audit the erasure
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit(
      {
        action: 'ERASURE_APPROVED',
        userId: user.id,
        resource: 'User',
        resourceId: user.id,
        changes: {
          before: { email: user.email, name: user.name },
          after: { email: anonymizedEmail, name: '[Redacted User]' },
        },
      },
      tx,
    )
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'ERASURE_APPROVED',
    actorId: user.id,
    targetUserId: request.userId,
  })
}

export async function denyErasure(
  requestId: string,
  reason?: string,
): Promise<void> {
  const user = await requirePermission('gdpr:manage')

  const request = await prisma.erasureRequest.findUnique({
    where: { id: requestId },
  })
  if (!request) throw new NotFoundError('ErasureRequest')
  if (request.status !== 'PENDING') {
    throw new Error('Erasure request is not pending')
  }

  await prisma.$transaction(async (tx) => {
    await tx.erasureRequest.update({
      where: { id: requestId },
      data: {
        status: 'DENIED',
        reviewedBy: user.id,
        reviewedAt: new Date(),
        reason: reason ?? null,
      },
    })

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit(
      {
        action: 'ERASURE_DENIED',
        userId: user.id,
        resource: 'ErasureRequest',
        resourceId: requestId,
      },
      tx,
    )
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'ERASURE_DENIED',
    actorId: user.id,
    targetUserId: request.userId,
  })
}
