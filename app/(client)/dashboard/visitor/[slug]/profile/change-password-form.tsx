'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePasswordAction } from './actions'

export function ChangePasswordForm({ slug }: { slug: string }) {
  const [state, action, pending] = useActionState(
    changePasswordAction.bind(null, slug),
    undefined,
  )

  return (
    <form action={action} className="flex flex-col gap-4 max-w-sm">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {state?.error && (
        <p className="text-sm text-destructive" role="alert">{state.error}</p>
      )}
      {state?.success && (
        <p className="text-sm text-emerald-600">Password updated.</p>
      )}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? 'Updating…' : 'Change password'}
      </Button>
    </form>
  )
}
