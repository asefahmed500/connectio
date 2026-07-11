'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { resendInviteAction } from './actions'

export function ResendButton({ slug }: { slug: string }) {
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)
  return (
    <form
      action={() => {
        setSent(false)
        startTransition(async () => {
          await resendInviteAction(slug)
          setSent(true)
        })
      }}
    >
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? 'Sending…' : sent ? 'Sent!' : 'Resend'}
      </Button>
    </form>
  )
}
