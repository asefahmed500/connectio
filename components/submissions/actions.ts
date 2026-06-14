'use server'

import { updateStatus } from '@/lib/dal/submissions'
import type { SubmissionStatus } from '@prisma/client'

export async function updateSubmissionStatusAction(
  submissionId: string,
  next: SubmissionStatus,
): Promise<void> {
  await updateStatus({ submissionId, next })
}
