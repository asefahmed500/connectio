'use server'

import { revalidatePath } from 'next/cache'
import { moderateDeleteComment } from '@/lib/dal/comments-moderation'

export async function moderateDeleteCommentAction(
  commentId: string,
  reason?: string,
): Promise<void> {
  await moderateDeleteComment(commentId, reason)
  revalidatePath('/admin/comments')
}
