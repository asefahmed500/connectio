'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { registerAction, type RegisterState } from './actions'

export function RegisterForm({
  invite,
}: {
  invite: { slug: string; email: string; companyName: string; contactName: string }
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, undefined)

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="slug" value={invite.slug} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" defaultValue={invite.email} required />
        <p className="text-xs text-muted-foreground">
          Must match the email the invite was sent to.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="name">Your name</Label>
        <Input id="name" name="name" defaultValue={invite.contactName} required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" required minLength={12} />
        <p className="text-xs text-muted-foreground">
          At least 12 characters, including a letter, number, and symbol.
        </p>
      </div>

      {state && 'error' in state && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state && 'fields' in state && state.fields && (
        <ul className="text-sm text-destructive list-disc pl-5" role="alert">
          {Object.entries(state.fields).map(([k, v]) => (
            <li key={k}>{(v as string[]).join(' ')}</li>
          ))}
        </ul>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating your account…' : 'Create account'}
      </Button>
    </form>
  )
}
