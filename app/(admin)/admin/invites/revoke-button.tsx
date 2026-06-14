'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { revokeInviteAction } from './actions'

export function RevokeButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <form
      action={() => {
        startTransition(async () => {
          await revokeInviteAction(slug)
        })
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? 'Revoking…' : 'Revoke'}
      </Button>
    </form>
  )
}
