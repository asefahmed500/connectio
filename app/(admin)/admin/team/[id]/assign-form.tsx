'use client'

import { useState, useTransition } from 'react'
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
import { Separator } from '@/components/ui/separator'
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
  const [selectedClientId, setSelectedClientId] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <Separator />
      <form
        action={(formData) => {
          if (!selectedClientId) return
          setError(null)
          startTransition(async () => {
            try {
              await assignAction(formData)
              router.refresh()
              setSelectedClientId('')
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to assign')
            }
          })
        }}
        className="flex flex-col gap-2 pt-4"
      >
      <input type="hidden" name="teamMemberId" value={teamMemberId} />
      <input type="hidden" name="clientId" value={selectedClientId} />
      <Label htmlFor="clientId">Assign to client</Label>
      <div className="flex gap-2">
        <Select
          required
          value={selectedClientId}
          onValueChange={setSelectedClientId}
        >
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
        <Button type="submit" disabled={pending || !selectedClientId}>
          {pending ? 'Assigning…' : 'Assign'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </form>
    </>
  )
}
