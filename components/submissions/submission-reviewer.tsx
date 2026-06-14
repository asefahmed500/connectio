'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { updateSubmissionStatusAction } from './actions'
import type { SubmissionStatus } from '@prisma/client'

// Shared submission-state-machine buttons. Used by both admin client-detail
// and team client-detail pages. Calls a single server action that delegates
// to lib/dal/submissions.ts → updateStatus, which enforces role + transition
// legality.

const ALL: { status: SubmissionStatus; label: string; variant: 'default' | 'outline' | 'destructive' }[] = [
  { status: 'IN_REVIEW', label: 'Start review', variant: 'outline' },
  { status: 'CHANGES_REQUESTED', label: 'Request changes', variant: 'outline' },
  { status: 'APPROVED', label: 'Approve', variant: 'default' },
  { status: 'REJECTED', label: 'Reject', variant: 'destructive' },
]

const ALLOWED: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: [],
  SUBMITTED: ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
  IN_REVIEW: ['CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
  CHANGES_REQUESTED: [],
  APPROVED: [],
  REJECTED: [],
}

export function SubmissionReviewer({
  submissionId,
  status,
}: {
  submissionId: string
  status: SubmissionStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const allowed = ALLOWED[status]

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t">
      {ALL.filter((b) => allowed.includes(b.status)).map((b) => (
        <Button
          key={b.status}
          type="button"
          variant={b.variant}
          size="sm"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              await updateSubmissionStatusAction(submissionId, b.status)
              router.refresh()
            })
          }}
        >
          {pending ? 'Updating…' : b.label}
        </Button>
      ))}
      {allowed.length === 0 && (
        <span className="text-xs text-muted-foreground self-center">
          {status === 'DRAFT' && "Client hasn't submitted yet."}
          {status === 'CHANGES_REQUESTED' && 'Waiting for client to revise and resubmit.'}
          {(status === 'APPROVED' || status === 'REJECTED') && 'Terminal — no further actions.'}
        </span>
      )}
    </div>
  )
}
