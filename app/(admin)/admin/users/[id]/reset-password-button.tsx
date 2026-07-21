'use client'

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
      {state && 'success' in state && (
        // The plaintext password is no longer shown in the UI — the user
        // receives a 6-digit OTP by email and picks their own password via
        // /reset-password. (Previously: returned + displayed in cleartext.)
        <div className="mt-2 text-sm bg-muted/50 rounded p-3">
          <span className="font-medium text-emerald-700">Password reset initiated.</span>{' '}
          A verification code has been emailed to {userName}. They can choose a new password
          at the reset page.
        </div>
      )}
      {state && 'error' in state && (
        <p className="text-sm text-destructive mt-1" role="alert">{state.error}</p>
      )}
    </form>
  )
}
