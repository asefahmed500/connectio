import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import type { Prisma } from '@prisma/client'

export type ModerationCommentDTO = {
  id: string
  message: string
  isInternal: boolean
  createdAt: Date
  deletedAt: Date | null
  clientId: string
  clientName: string
  authorId: string
  authorName: string
  authorRole: string
  submissionId: string | null
}

export type CommentListParams = PaginationParams & {
  search?: string
  authorRole?: string
  internalOnly?: boolean
}

/**
 * Lists ALL comments across all clients for admin moderation. Includes
 * soft-deleted ones (so admins can review removals). Supports search, role
 * filter, internal-only filter, and pagination.
 */
export async function listAllCommentsForModeration(
  params?: CommentListParams,
): Promise<PaginatedResult<ModerationCommentDTO>> {
  await requirePermission('comment:read')

  const { take, skip } = paginationParams(params)

  const where: Prisma.CommentWhereInput = {}
  if (params?.search) {
    where.message = { contains: params.search, mode: 'insensitive' }
  }
  if (params?.authorRole) {
    where.author = { role: params.authorRole as Prisma.UserWhereInput['role'] }
  }
  if (params?.internalOnly) {
    where.isInternal = true
  }

  const [rows, total] = await Promise.all([
    prisma.comment.findMany({
      where,
      include: {
        client: { select: { id: true, companyName: true } },
        author: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.comment.count({ where }),
  ])

  const items = rows.map((c) => ({
    id: c.id,
    message: c.message,
    isInternal: c.isInternal,
    createdAt: c.createdAt,
    deletedAt: c.deletedAt,
    clientId: c.client.id,
    clientName: c.client.companyName,
    authorId: c.author.id,
    authorName: c.author.name,
    authorRole: c.author.role,
    submissionId: c.submissionId,
  }))

  return toPaginated(items, total, params)
}

/**
 * Admin-side comment deletion: hard delete (with audit) for moderation use.
 * Different from the soft-delete in lib/dal/comments.ts which is the user-facing
 * "delete my own comment" path. This is for content moderation: removes the
 * comment row entirely so it can't be undeleted.
 *
 * Use with care — preferred path is soft-delete. Hard-delete is reserved for
 * spam/abuse cleanup where the audit log alone is the record.
 */
export async function moderateDeleteComment(
  commentId: string,
  reason?: string,
): Promise<void> {
  const admin = await requirePermission('comment:delete')

  const existing = await prisma.comment.findUnique({
    where: { id: commentId },
    select: { id: true, message: true, clientId: true, authorId: true },
  })
  if (!existing) return

  await prisma.comment.delete({ where: { id: commentId } })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'COMMENT_MODERATED_DELETE',
    userId: admin.id,
    resource: 'Comment',
    resourceId: commentId,
    changes: {
      before: { message: existing.message.slice(0, 200), authorId: existing.authorId },
      after: reason ? { reason } : undefined,
    },
  })
}
