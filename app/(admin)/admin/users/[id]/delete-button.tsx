'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { deleteUserAction } from '../actions'
import { Trash2 } from 'lucide-react'

export function DeleteButton({ userId, userName }: { userId: string; userName: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      className="text-destructive hover:text-destructive hover:bg-destructive/10"
      disabled={pending}
      onClick={() => {
        if (!confirm(`Delete user "${userName}"? This is irreversible.`)) return
        startTransition(async () => { await deleteUserAction(userId); router.push('/admin/users') })
      }}
    >
      <Trash2 data-icon="inline-start" />
      {pending ? 'Deleting…' : 'Delete user'}
    </Button>
  )
}
