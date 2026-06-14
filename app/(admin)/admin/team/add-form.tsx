'use client'

import { useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addTeamMemberAction, type AddTeamMemberState } from './actions'

export function AddTeamMemberForm() {
  const router = useRouter()
  const [state, action, pending] = useActionState<AddTeamMemberState, FormData>(
    addTeamMemberAction,
    undefined,
  )

  return (
    <form action={action} className="border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" required maxLength={120} disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required disabled={pending} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Temp password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={12}
            disabled={pending}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="department">Department (optional)</Label>
          <Input id="department" name="department" maxLength={80} disabled={pending} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        The team member signs in with this email + temporary password. They should change it
        after first login (password reset flow — planned).
      </p>

      {state && 'error' in state && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state && 'success' in state && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          Team member created.
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Add team member'}
      </Button>
    </form>
  )
}
