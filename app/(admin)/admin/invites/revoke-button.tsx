'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { revokeInviteAction } from './actions'

export function RevokeButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      action={() => {
        setError(null)
        startTransition(async () => {
          try {
            await revokeInviteAction(slug)
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke')
          }
        })
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? 'Revoking…' : 'Revoke'}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </form>
  )
}
