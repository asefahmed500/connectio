'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { unassignAction } from './actions'

export function UnassignButton({
  teamMemberId,
  clientId,
}: {
  teamMemberId: string
  clientId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={() => {
        startTransition(async () => {
          await unassignAction(teamMemberId, clientId)
          router.refresh()
        })
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? 'Removing…' : 'Unassign'}
      </Button>
    </form>
  )
}
