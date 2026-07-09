'use client'

import { useState } from 'react'
import { createScimKeyAction, revokeScimKeyAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KeyRound, Copy, Trash2, Plus } from 'lucide-react'
import type { ScimApiKeyDTO } from '@/lib/dal/sso'

export function ScimApiKeysSection({ keys }: { keys: ScimApiKeyDTO[] }) {
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-heading tracking-wide">SCIM API keys</CardTitle>
            <CardDescription className="text-xs">
              Used by identity providers to provision users via SCIM 2.0.
            </CardDescription>
          </div>
          <ScimCreateForm onCreated={setNewKey} />
        </div>
      </CardHeader>
      <CardContent>
        {newKey && (
          <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm dark:border-green-800 dark:bg-green-950">
            <p className="font-medium text-green-800 dark:text-green-200">API key created</p>
            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
              Copy this now. You won&apos;t see it again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 rounded bg-green-100 px-2 py-1 text-xs dark:bg-green-900">
                {newKey.key}
              </code>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => navigator.clipboard.writeText(newKey.key)}
              >
                <Copy className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SCIM API keys configured.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <KeyRound className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium">{k.name}</span>
                    <code className="ml-2 text-xs text-muted-foreground">{k.prefix}...</code>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={k.isActive ? 'default' : 'secondary'}>
                    {k.isActive ? 'Active' : 'Revoked'}
                  </Badge>
                  {k.isActive && (
                    <form action={revokeScimKeyAction.bind(null, k.id)}>
                      <Button variant="ghost" size="icon-sm" type="submit">
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ScimCreateForm({ onCreated }: { onCreated: (v: { key: string; name: string }) => void }) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus className="w-3 h-3 mr-1" />
        New key
      </Button>
    )
  }

  return (
    <form
      action={async (fd) => {
        const result = await createScimKeyAction(null, fd)
        if (result.key) {
          onCreated(result)
          setOpen(false)
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        name="name"
        placeholder="Key name"
        required
        className="h-8 rounded-md border px-2 text-xs"
      />
      <Button type="submit" size="sm">
        Create
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  )
}
