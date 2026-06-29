import { getCommentsDTO } from '@/lib/dal/comments'
import { getCurrentUser } from '@/lib/dal/session'
import { CommentList } from './comment-list'
import { CommentForm } from './comment-form'

// Server component. Fetches comments + viewer, then renders the list + form.
// Re-exported under components/comments so admin and client pages share it.

export async function CommentThread({
  clientId,
  submissionId,
}: {
  clientId: string
  submissionId?: string
}) {
  const [comments, viewer] = await Promise.all([
    getCommentsDTO({ clientId, submissionId }),
    getCurrentUser(),
  ])
  if (!viewer) return null

  return (
    <div className="flex flex-col gap-4">
      <CommentList comments={comments} viewerRole={viewer.role} viewerId={viewer.id} clientId={clientId} />
      <CommentForm
        clientId={clientId}
        submissionId={submissionId}
        viewerRole={viewer.role}
      />
    </div>
  )
}
