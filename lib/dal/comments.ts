import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireClientAccess, getCurrentUser } from '@/lib/dal/session'
import type { UserRole } from '@prisma/client'

// 2-level threading per docs/06-comments.md. Replies always point to a
// top-level comment; the UI hides the reply button on replies so the depth
// can't grow beyond 2.

export type CommentNode = {
  id: string
  authorId: string
  authorName: string
  authorRole: UserRole
  message: string
  isInternal: boolean
  createdAt: string // ISO string — crossing into Client Components
  submissionId: string | null
  parentId: string | null
  replies: CommentNode[]
}

type Row = {
  id: string
  message: string
  isInternal: boolean
  createdAt: Date
  submissionId: string | null
  parentId: string | null
  authorId: string
  author: { id: string; name: string; role: UserRole }
}

function toNode(r: Row, replies: CommentNode[]): CommentNode {
  return {
    id: r.id,
    authorId: r.author.id,
    authorName: r.author.name,
    authorRole: r.author.role,
    message: r.message,
    isInternal: r.isInternal,
    createdAt: r.createdAt.toISOString(),
    submissionId: r.submissionId,
    parentId: r.parentId,
    replies,
  }
}

/**
 * Returns the comment tree for a client (optionally scoped to a submission).
 * Internal comments are filtered out for CLIENT viewers — enforced here, not
 * in the UI. The DB doesn't lie.
 */
export const getCommentsDTO = cache(
  async (opts: { clientId: string; submissionId?: string }): Promise<CommentNode[]> => {
    const user = await requireClientAccess(opts.clientId)

    const rows = await prisma.comment.findMany({
      where: {
        clientId: opts.clientId,
        submissionId: opts.submissionId ?? null,
        deletedAt: null,
        // Clients never see internal comments.
        ...(user!.role === 'CLIENT' ? { isInternal: false } : {}),
      },
      include: { author: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const repliesByParent = new Map<string, CommentNode[]>()
    for (const r of rows) {
      if (r.parentId) {
        const arr = repliesByParent.get(r.parentId) ?? []
        arr.push(toNode(r, []))
        repliesByParent.set(r.parentId, arr)
      }
    }

    return rows
      .filter((r) => r.parentId === null)
      .map((r) => toNode(r, repliesByParent.get(r.id) ?? []))
  },
)

export async function countComments(clientId: string, isInternal?: boolean): Promise<number> {
  await requireClientAccess(clientId)
  return prisma.comment.count({
    where: {
      clientId,
      deletedAt: null,
      ...(isInternal !== undefined ? { isInternal } : {}),
    },
  })
}

export async function postComment(opts: {
  clientId: string
  submissionId?: string
  parentId?: string
  message: string
  isInternal?: boolean
}): Promise<{ id: string }> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  // requireClientAccess works for any logged-in user with access to this client.
  await requireClientAccess(opts.clientId)

  const message = opts.message.trim()
  if (!message) throw new Error('Message is empty')
  if (message.length > 5000) throw new Error('Message exceeds 5000 characters')

  // Clients cannot post internal comments. Strip the flag unconditionally.
  const isInternal = user.role === 'CLIENT' ? false : (opts.isInternal ?? false)

  // If a parent is provided, it must:
  //   - exist
  //   - belong to the same client
  //   - be a top-level comment (parentId === null on the parent)
  //     — otherwise we'd be creating a 3rd level, breaking the depth invariant.
  if (opts.parentId) {
    const parent = await prisma.comment.findFirst({ where: { id: opts.parentId, deletedAt: null } })
    if (!parent || parent.clientId !== opts.clientId) {
      throw new Error('Invalid parent comment')
    }
    if (parent.parentId !== null) {
      throw new Error('Cannot reply to a reply (max depth is 2 levels)')
    }
  }

  // If submissionId provided, it must belong to this client.
  if (opts.submissionId) {
    const sub = await prisma.submission.findFirst({ where: { id: opts.submissionId, deletedAt: null } })
    if (!sub || sub.clientId !== opts.clientId) {
      throw new Error('Invalid submission')
    }
  }

  const created = await prisma.comment.create({
    data: {
      clientId: opts.clientId,
      authorId: user.id,
      submissionId: opts.submissionId ?? null,
      parentId: opts.parentId ?? null,
      message,
      isInternal,
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: isInternal ? 'COMMENT_POSTED_INTERNAL' : 'COMMENT_POSTED_EXTERNAL',
    userId: user.id,
    resource: 'Comment',
    resourceId: created.id,
  })

  // Fire the appropriate notification. Audience computation in audience.ts
  // is the security boundary for visibility.
  const { notify } = await import('@/lib/notifications/notify')
  const messagePreview = message.slice(0, 140)
  const baseEvent = {
    actorId: user.id,
    clientId: opts.clientId,
    commentId: created.id,
    submissionId: opts.submissionId,
    messagePreview,
  }

  if (opts.parentId) {
    // Reply → notify parent author (one-on-one ping).
    const parent = await prisma.comment.findUnique({ where: { id: opts.parentId } })
    if (parent) {
      await notify({
        type: 'COMMENT_REPLY',
        ...baseEvent,
        parentAuthorId: parent.authorId,
      })
    }
  } else if (isInternal) {
    await notify({ type: 'COMMENT_POSTED_INTERNAL', ...baseEvent })
  } else if (user.role === 'CLIENT') {
    await notify({ type: 'COMMENT_POSTED_EXTERNAL_BY_CLIENT', ...baseEvent })
  } else {
    await notify({ type: 'COMMENT_POSTED_EXTERNAL', ...baseEvent })
  }

  return { id: created.id }
}

export async function deleteComment(commentId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  const comment = await prisma.comment.findFirst({ where: { id: commentId, deletedAt: null } })
  if (!comment) return

  await requireClientAccess(comment.clientId)

  const canDelete =
    user.role === 'SUPER_ADMIN' || comment.authorId === user.id
  if (!canDelete) throw new Error('Not allowed to delete this comment')

  // Soft-delete only — preserves data for audit trail. Cascade soft-deletes
  // to replies via a separate update (the self-relation handles the link).
  await prisma.$transaction(async (tx) => {
    await tx.comment.updateMany({
      where: { OR: [{ id: commentId }, { parentId: commentId }] },
      data: { deletedAt: new Date() },
    })
    const { writeAudit } = await import('@/lib/audit')
    await writeAudit(
      {
        action: 'COMMENT_DELETED',
        userId: user.id,
        resource: 'Comment',
        resourceId: commentId,
      },
      tx,
    )
  })
}
