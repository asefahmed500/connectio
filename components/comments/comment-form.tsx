'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { postCommentAction, type CommentFormState } from './actions'
import type { UserRole } from '@prisma/client'

export function CommentForm({
  clientId,
  submissionId,
  viewerRole,
}: {
  clientId: string
  submissionId?: string
  viewerRole: UserRole
}) {
  const canMarkInternal = viewerRole === 'SUPER_ADMIN' || viewerRole === 'TEAM_MEMBER'
  const [state, action, pending] = useActionState<CommentFormState, FormData>(
    postCommentAction,
    undefined,
  )

  return (
    <form action={action} className="space-y-3 border-t pt-4">
      <input type="hidden" name="clientId" value={clientId} />
      {submissionId && <input type="hidden" name="submissionId" value={submissionId} />}

      <div className="space-y-1.5">
        <Label htmlFor="message">New message</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Write a message…"
          required
          maxLength={5000}
          disabled={pending}
        />
      </div>

      {canMarkInternal && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isInternal" className="h-4 w-4" disabled={pending} />
          <span>Internal (hidden from client)</span>
        </label>
      )}

      {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending}>
        {pending ? 'Posting…' : 'Post message'}
      </Button>
    </form>
  )
}
