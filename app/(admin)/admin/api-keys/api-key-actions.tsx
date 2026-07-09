'use client'

import { revokeKeyAction } from './actions'
import { Button } from '@/components/ui/button'

export function ApiKeyActions({ keyId, isActive }: { keyId: string; isActive: boolean }) {
  if (!isActive) return null
  return (
    <form action={revokeKeyAction.bind(null, keyId)}>
      <Button variant="ghost" size="sm" type="submit" className="text-destructive text-xs">
        Revoke
      </Button>
    </form>
  )
}
