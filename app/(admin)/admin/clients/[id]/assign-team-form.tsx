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
import { assignTeamMemberAction } from './actions'

export function AssignTeamForm({
  clientId,
  teamMembers,
}: {
  clientId: string
  teamMembers: { id: string; name: string; email: string }[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState('')
  const [error, setError] = useState<string | null>(null)

  return (
    <form
      action={(formData) => {
        if (!selected) return
        setError(null)
        startTransition(async () => {
          try {
            await assignTeamMemberAction(formData)
            router.refresh()
            setSelected('')
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to assign')
          }
        })
      }}
    >
      <input type="hidden" name="clientId" value={clientId} />
      <input type="hidden" name="teamMemberId" value={selected} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="assign-team-select">Assign a team member</Label>
        <div className="flex gap-2">
          <Select required value={selected} onValueChange={setSelected}>
            <SelectTrigger id="assign-team-select" className="flex-1">
              <SelectValue placeholder="Choose a team member…" />
            </SelectTrigger>
            <SelectContent>
              {teamMembers.map((tm) => (
                <SelectItem key={tm.id} value={tm.id}>
                  {tm.name} — {tm.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={pending || !selected}>
            {pending ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive mt-1" role="alert">{error}</p>}
    </form>
  )
}
