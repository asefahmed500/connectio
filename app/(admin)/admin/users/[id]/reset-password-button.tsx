'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { adminResetPasswordAction, type UserActionState } from '../actions'
import { useActionState } from 'react'
import { Key } from 'lucide-react'

export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [state, action, pending] = useActionState<UserActionState>(
    async () => adminResetPasswordAction(userId),
    undefined,
  )

  return (
    <form action={action}>
      <Button type="submit" variant="outline" disabled={pending}>
        <Key data-icon="inline-start" />
        {pending ? 'Resetting…' : `Reset password`}
      </Button>
      {state && 'success' in state && state.password && (
        <div className="mt-2 text-sm bg-muted/50 rounded p-3">
          <span className="font-medium text-emerald-700">Password reset.</span>{' '}
          New password: <code className="font-mono text-xs bg-muted px-1 rounded">{state.password}</code>
          <br />
          <span className="text-xs text-muted-foreground">An email has been sent to {userName}.</span>
        </div>
      )}
      {state && 'error' in state && (
        <p className="text-sm text-destructive mt-1" role="alert">{state.error}</p>
      )}
    </form>
  )
}
