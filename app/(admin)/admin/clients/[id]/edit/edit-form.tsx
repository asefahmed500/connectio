'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { updateClientAction, type UpdateClientState } from '../actions'
import type { ClientDTO } from '@/lib/dal/clients'

export function EditClientForm({ client }: { client: ClientDTO }) {
  const [state, formAction, pending] = useActionState(
    updateClientAction.bind(null, client.id),
    undefined,
  )

  if (state && 'success' in state && state.success) {
    return (
      <Card>
        <CardContent className="p-6 text-center flex flex-col items-center gap-3">
          <p className="text-sm text-muted-foreground">Client updated successfully.</p>
          <Button asChild>
            <Link href={`/admin/clients/${client.id}`}>Back to client</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-4">
      <Card>
        <CardContent className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="companyName" className="text-sm font-medium">Company name</label>
            <Input id="companyName" name="companyName" defaultValue={client.companyName} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="contactName" className="text-sm font-medium">Contact name</label>
            <Input id="contactName" name="contactName" defaultValue={client.contactName} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="projectBrief" className="text-sm font-medium">Project brief</label>
            <Input id="projectBrief" name="projectBrief" defaultValue={client.projectBrief ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="budget" className="text-sm font-medium">Budget</label>
            <Input id="budget" name="budget" defaultValue={client.budget ?? ''} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="timeline" className="text-sm font-medium">Timeline</label>
            <Input id="timeline" name="timeline" defaultValue={client.timeline ?? ''} />
          </div>
          {state && 'error' in state && state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </CardContent>
      </Card>
      <div className="flex gap-3 justify-end">
        <Button type="button" variant="outline" asChild>
          <Link href={`/admin/clients/${client.id}`}>Cancel</Link>
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
