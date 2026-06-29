'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toggleBlockAction } from '../actions'
import { Lock, Unlock } from 'lucide-react'

export function BlockButton({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant={isActive ? 'destructive' : 'default'}
      disabled={pending}
      onClick={() => startTransition(async () => { await toggleBlockAction(userId); router.refresh() })}
    >
      {isActive ? <Lock data-icon="inline-start" /> : <Unlock data-icon="inline-start" />}
      {pending ? (isActive ? 'Blocking…' : 'Unblocking…') : (isActive ? 'Block user' : 'Unblock user')}
    </Button>
  )
}
