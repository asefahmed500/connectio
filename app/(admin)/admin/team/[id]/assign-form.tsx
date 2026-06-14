'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { assignAction } from './actions'

export function AssignClientForm({
  teamMemberId,
  clients,
}: {
  teamMemberId: string
  clients: { id: string; companyName: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          await assignAction(formData)
          router.refresh()
        })
      }}
      className="border-t pt-4 space-y-2"
    >
      <input type="hidden" name="teamMemberId" value={teamMemberId} />
      <Label htmlFor="clientId">Assign to client</Label>
      <div className="flex gap-2">
        <Select name="clientId" required>
          <SelectTrigger id="clientId" className="flex-1">
            <SelectValue placeholder="Choose a client…" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.companyName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pending}>
          {pending ? 'Assigning…' : 'Assign'}
        </Button>
      </div>
    </form>
  )
}
