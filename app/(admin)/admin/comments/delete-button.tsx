'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { moderateDeleteCommentAction } from './actions'

export function ModerateDeleteButton({
  commentId,
  disabled,
}: {
  commentId: string
  disabled?: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      action={() => {
        setError(null)
        startTransition(async () => {
          try {
            await moderateDeleteCommentAction(commentId)
          } catch (err) {
            console.error('[comments] moderate delete failed:', err)
            setError('Failed to delete')
          }
        })
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending || disabled}
        className="text-destructive hover:text-destructive"
        aria-label="Delete comment"
      >
        {pending ? 'Deleting…' : 'Delete'}
      </Button>
      {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
    </form>
  )
}
