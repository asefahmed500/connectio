'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createInviteAction } from './actions'

export function CreateInviteForm() {
  const [state, action, pending] = useActionState(createInviteAction, undefined)

  return (
    <form action={action} className="border rounded-lg p-4 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Client email</Label>
          <Input id="email" name="email" type="email" required placeholder="jane@acme.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="companyName">Company</Label>
          <Input id="companyName" name="companyName" required placeholder="Acme Corp" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Contact name</Label>
          <Input id="contactName" name="contactName" required placeholder="Jane Smith" />
        </div>
      </div>
      {state && 'error' in state && <p className="text-sm text-destructive">{state.error}</p>}
      {state && 'success' in state && (
        <div className="text-sm space-y-1 bg-muted/50 rounded p-3">
          <div className="font-medium text-emerald-700 dark:text-emerald-400">Invite created</div>
          <div>
            Share this link with the client:{' '}
            <code className="font-mono text-xs break-all">{state.inviteLink}</code>
          </div>
        </div>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? 'Creating…' : 'Create invite'}
      </Button>
    </form>
  )
}
