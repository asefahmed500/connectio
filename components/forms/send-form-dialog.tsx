'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { SendIcon, XIcon } from 'lucide-react'
import { sendFormToUsersAction, type SendFormState } from '@/app/(admin)/admin/forms/actions'

type UserItem = {
  id: string
  name: string
  email: string
  role: string
  hasClient: boolean
}

interface SendFormDialogProps {
  formId: string
  users: UserItem[]
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  TEAM_MEMBER: 'Team',
  CLIENT: 'Client',
}

export function SendFormDialog({ formId, users }: SendFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [state, formAction, pending] = useActionState<SendFormState | undefined, FormData>(
    sendFormToUsersAction,
    undefined,
  )

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (!search) return true
    const q = search.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleSubmit(formData: FormData) {
    formData.set('formId', formId)
    formData.set('userIds', JSON.stringify([...selected]))
    formAction(formData)
  }

  const selectedUsers = users.filter((u) => selected.has(u.id))

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSelected(new Set()) }}>
      <DialogTrigger asChild>
        <Button>
          <SendIcon data-icon="inline-start" />
          Send form
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send form to users</DialogTitle>
          <DialogDescription>
            Select users to send this form to. They will receive a notification with a link to fill it out.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Filter by role</Label>
            <div className="flex flex-row gap-2 flex-wrap">
              {(['all', 'CLIENT', 'TEAM_MEMBER', 'SUPER_ADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    roleFilter === r
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  }`}
                >
                  {r === 'all' ? 'All' : ROLE_LABELS[r] ?? r}
                </button>
              ))}
            </div>
          </div>

          {selectedUsers.length > 0 && (
            <div className="flex flex-row gap-2 flex-wrap">
              {selectedUsers.map((u) => (
                <Badge key={u.id} variant="secondary" className="gap-1">
                  {u.name}
                  <button type="button" onClick={() => toggle(u.id)} className="hover:text-destructive">
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div>
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border rounded-lg p-1">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground p-3 text-center">No users found</p>
            )}
            {filtered.map((u) => (
              <label
                key={u.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-muted ${
                  selected.has(u.id) ? 'bg-muted' : ''
                }`}
              >
                <Checkbox
                  checked={selected.has(u.id)}
                  onCheckedChange={() => toggle(u.id)}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-medium truncate">{u.name}</span>
                  <span className="text-xs text-muted-foreground truncate">{u.email}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {ROLE_LABELS[u.role] ?? u.role}
                </span>
              </label>
            ))}
          </div>

          {state && 'error' in state && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
          {state && 'ok' in state && (
            <p className="text-sm text-green-600">Form sent to {state.recipients} user(s).</p>
          )}

          <DialogFooter>
            <Button type="submit" disabled={selected.size === 0 || pending}>
              <SendIcon data-icon="inline-start" />
              {pending ? 'Sending...' : `Send to ${selected.size} user(s)`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
