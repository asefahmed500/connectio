'use server'

import { z } from 'zod'
import { updateStatus } from '@/lib/dal/submissions'
import type { SubmissionStatus } from '@prisma/client'

const Schema = z.object({
  submissionId: z.string().cuid(),
  next: z.enum(['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED']),
})

export async function updateSubmissionStatusAction(
  submissionId: string,
  next: SubmissionStatus,
): Promise<{ error: string } | undefined> {
  const parsed = Schema.safeParse({ submissionId, next })
  if (!parsed.success) return { error: 'Invalid parameters.' }

  try {
    await updateStatus({ submissionId, next })
  } catch (err) {
    console.error('[submissions] updateSubmissionStatusAction failed:', err)
    return { error: err instanceof Error ? err.message : 'Something went wrong.' }
  }
}
