'use client'

import { useState, useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { postReplyAction } from './actions'

// Inline form that appears when "Reply" is clicked. Hidden by default to keep
// the thread scannable. Wraps a Server Action via useActionState.

export function ReplyForm({
  parentId,
  clientId,
  submissionId,
}: {
  parentId: string
  clientId: string
  submissionId?: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(postReplyAction, undefined)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground mt-2"
      >
        Reply
      </button>
    )
  }

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="parentId" value={parentId} />
      <input type="hidden" name="clientId" value={clientId} />
      {submissionId && <input type="hidden" name="submissionId" value={submissionId} />}
      <Textarea
        name="message"
        rows={3}
        placeholder="Write a reply…"
        required
        maxLength={5000}
        disabled={pending}
      />
      {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? 'Posting…' : 'Post reply'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
