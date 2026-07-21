'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { revokeInviteAction } from './actions'
import { CopyLinkButton } from './copy-link-button'

export function InviteActions({
  slug,
  status,
}: {
  slug: string
  status: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const isOpen = status === 'OPEN'

  return (
    <div className="flex items-center gap-1">
      <CopyLinkButton slug={slug} disabled={!isOpen} />

      <form
        action={() => {
          setError(null)
          startTransition(async () => {
            try {
              await revokeInviteAction(slug)
            } catch (err) {
              console.error('[invites] revoke failed:', err)
              setError('Failed to revoke')
            }
          })
        }}
      >
        <Button
          type="submit"
          variant="ghost"
          size="sm"
          disabled={pending || !isOpen}
          aria-label={isOpen ? `Revoke invite ${slug}` : `Invite ${slug} is not revocable`}
        >
          {pending ? 'Revoking…' : 'Revoke'}
        </Button>
      </form>

      {error && <p className="text-xs text-destructive mt-1" role="alert">{error}</p>}
    </div>
  )
}
