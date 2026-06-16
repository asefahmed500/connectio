'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { unassignTeamMemberAction } from './actions'

export function UnassignTeamButton({
  teamMemberId,
  clientId,
}: {
  teamMemberId: string
  clientId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      action={() => {
        setError(null)
        startTransition(async () => {
          try {
            await unassignTeamMemberAction(teamMemberId, clientId)
            router.refresh()
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to unassign')
          }
        })
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? 'Removing…' : 'Unassign'}
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </form>
  )
}
