'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { registerAction, type RegisterState } from './actions'

export function RegisterForm({
  invite,
}: {
  invite: { slug: string; email: string; companyName: string; contactName: string }
}) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerAction, undefined)

  if (state && 'success' in state) {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-emerald-700">Account created!</span>
            <span className="text-sm text-muted-foreground">
              Your account for <span className="font-medium text-foreground">{invite.companyName}</span> is ready.
            </span>
          </div>

          <div className="bg-muted/50 rounded p-4 flex flex-col gap-3 text-sm">
            <div className="flex flex-col gap-1">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Email</span>
              <span className="font-mono">{state.email}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Password</span>
              <span className="font-mono">{state.password}</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Save your password now. You will need it to sign in.
          </p>

          <Button asChild className="w-full mt-2">
            <Link href={`/dashboard/visitor/${invite.slug}`}>Continue to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

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
        {pending ? 'Creating your account&#8230;' : 'Create account'}
      </Button>
    </form>
  )
}
