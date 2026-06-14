import { ReplyForm } from './reply-form'
import type { CommentNode } from '@/lib/dal/comments'
import type { UserRole } from '@prisma/client'

// Server component. Renders the 2-level tree. Reply buttons only appear on
// top-level comments (per docs/06-comments.md depth rule).

export function CommentList({
  comments,
  viewerRole,
  clientId,
}: {
  comments: CommentNode[]
  viewerRole: UserRole
  clientId: string
}) {
  if (comments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No messages yet. Start the conversation below.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="border rounded-lg p-3">
          <CommentView c={c} viewerRole={viewerRole} />
          {c.replies.length > 0 && (
            <ul className="mt-3 ml-4 pl-4 border-l space-y-2">
              {c.replies.map((r) => (
                <li key={r.id}>
                  <CommentView c={r} viewerRole={viewerRole} />
                </li>
              ))}
            </ul>
          )}
          <ReplyForm parentId={c.id} clientId={clientId} />
        </li>
      ))}
    </ul>
  )
}

function CommentView({ c, viewerRole }: { c: CommentNode; viewerRole: UserRole }) {
  const roleColor =
    c.authorRole === 'SUPER_ADMIN'
      ? 'text-purple-700 dark:text-purple-300'
      : c.authorRole === 'TEAM_MEMBER'
        ? 'text-blue-700 dark:text-blue-300'
        : 'text-emerald-700 dark:text-emerald-300'

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="font-medium">{c.authorName}</span>
        <span className={`text-xs uppercase tracking-wide ${roleColor}`}>{c.authorRole.replace('_', ' ')}</span>
        {c.isInternal && viewerRole !== 'CLIENT' && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            internal
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          {new Date(c.createdAt).toLocaleString()}
        </span>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{c.message}</p>
    </div>
  )
}
