'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { postComment, deleteComment } from '@/lib/dal/comments'

const PostSchema = z.object({
  clientId: z.string().cuid(),
  submissionId: z.string().cuid().optional(),
  message: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().optional(),
})

export type CommentFormState =
  | undefined
  | { error: string }
  | { success: true }

function readPostInput(formData: FormData) {
  return PostSchema.safeParse({
    clientId: formData.get('clientId'),
    submissionId: formData.get('submissionId') || undefined,
    message: formData.get('message'),
    isInternal: formData.get('isInternal') === 'on',
  })
}

export async function postCommentAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const parsed = readPostInput(formData)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  try {
    await postComment(parsed.data)
    revalidateForClient(parsed.data.clientId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to post' }
  }
}

export async function postReplyAction(
  _prev: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const parsed = PostSchema.extend({ parentId: z.string().cuid() }).safeParse({
    clientId: formData.get('clientId'),
    submissionId: formData.get('submissionId') || undefined,
    parentId: formData.get('parentId'),
    message: formData.get('message'),
    isInternal: formData.get('isInternal') === 'on',
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const { parentId, ...rest } = parsed.data
  try {
    await postComment({ ...rest, parentId })
    revalidateForClient(parsed.data.clientId)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to post' }
  }
}

export async function deleteCommentAction(commentId: string, clientId: string): Promise<void> {
  const parsed = z.object({
    commentId: z.string().cuid(),
    clientId: z.string().cuid(),
  }).safeParse({ commentId, clientId })
  if (!parsed.success) return

  try {
    await deleteComment(commentId)
    revalidateForClient(clientId)
  } catch (err) {
    console.error('[comments] deleteCommentAction failed:', err)
  }
}

// Refresh both the admin client-detail view and the client messages view so
// both stay in sync after a post.
function revalidateForClient(clientId: string) {
  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath(`/team/clients/${clientId}`)
  revalidatePath(`/dashboard/visitor/`, 'page')
}
