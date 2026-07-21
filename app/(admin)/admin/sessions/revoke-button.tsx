'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { revokeSessionAction } from './actions'

export function RevokeSessionButton({ sessionId }: { sessionId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={() => {
        startTransition(async () => {
          await revokeSessionAction(sessionId)
        })
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive hover:text-destructive"
        aria-label="Revoke session"
      >
        {pending ? 'Revoking…' : 'Revoke'}
      </Button>
    </form>
  )
}
