'use client'

import { useTransition } from 'react'
import { Trash2, MessageSquare } from 'lucide-react'
import { ReplyForm } from './reply-form'
import { deleteCommentAction } from './actions'
import type { CommentNode } from '@/lib/dal/comments'
import type { UserRole } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function CommentList({
  comments,
  viewerRole,
  viewerId,
  clientId,
  onDelete,
}: {
  comments: CommentNode[]
  viewerRole: UserRole
  viewerId: string
  clientId: string
  onDelete?: (id: string) => void
}) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No messages yet. Start the conversation below.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {comments.map((c) => (
        <li key={c.id}>
          <Card>
            <CardContent className="p-3">
              <CommentView c={c} viewerRole={viewerRole} viewerId={viewerId} clientId={clientId} onDelete={onDelete} />
              {c.replies.length > 0 && (
                <ul className="mt-3 ml-4 pl-4 border-l flex flex-col gap-2">
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <CommentView c={r} viewerRole={viewerRole} viewerId={viewerId} clientId={clientId} onDelete={onDelete} />
                    </li>
                  ))}
                </ul>
              )}
              <ReplyForm parentId={c.id} clientId={clientId} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  )
}

function CommentView({
  c,
  viewerRole,
  viewerId,
  clientId,
  onDelete,
}: {
  c: CommentNode
  viewerRole: UserRole
  viewerId: string
  clientId: string
  onDelete?: (id: string) => void
}) {
  const [pending, startTransition] = useTransition()
  const canDelete = viewerRole === 'SUPER_ADMIN' || c.authorId === viewerId

  const roleColor =
    c.authorRole === 'SUPER_ADMIN'
      ? 'text-purple-700'
      : c.authorRole === 'TEAM_MEMBER'
        ? 'text-blue-700'
        : 'text-emerald-700'

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="font-medium">{c.authorName}</span>
        <span className={cn('text-xs uppercase tracking-wide', roleColor)}>
          {c.authorRole.replace('_', ' ')}
        </span>
        {c.isInternal && viewerRole !== 'CLIENT' && (
          <Badge variant="outline">internal</Badge>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(c.createdAt).toLocaleString()}
        </span>
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-1 text-muted-foreground hover:text-destructive"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                onDelete?.(c.id)
                deleteCommentAction(c.id, clientId)
              })
            }
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{c.message}</p>
    </div>
  )
}
