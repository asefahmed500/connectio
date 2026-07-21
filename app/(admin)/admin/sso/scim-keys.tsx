'use client'

import { useState } from 'react'
import { createScimKeyAction, revokeScimKeyAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { KeyRound, Copy, Trash2, Plus, Check } from 'lucide-react'
import type { ScimApiKeyDTO } from '@/lib/dal/sso'

export function ScimApiKeysSection({ keys }: { keys: ScimApiKeyDTO[] }) {
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

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
          <Alert className="mb-4 border-emerald-500/40 bg-emerald-500/5">
            <Check className="h-4 w-4 text-emerald-600" />
            <AlertTitle>API key created</AlertTitle>
            <AlertDescription>
              <p>Copy this now. You won&apos;t see it again.</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-2 py-1 text-xs font-mono break-all">
                  {newKey.key}
                </code>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Copy API key"
                  onClick={() => {
                    navigator.clipboard.writeText(newKey.key)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  {copied
                    ? <Check className="w-3 h-3 text-emerald-600" />
                    : <Copy className="w-3 h-3" />}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground">No SCIM API keys configured.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {keys.map((k) => (
              <Card key={k.id}>
                <CardContent className="p-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium">{k.name}</span>
                      <code className="ml-2 text-xs text-muted-foreground">{k.prefix}...</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={k.isActive ? 'default' : 'secondary'}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </Badge>
                    {k.isActive && (
                      <form action={revokeScimKeyAction.bind(null, k.id)}>
                        <Button variant="ghost" size="icon-sm" type="submit" aria-label={`Revoke key ${k.name}`}>
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
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
        <Plus className="w-3 h-3" data-icon="inline-start" />
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
      className="flex flex-col sm:flex-row sm:items-end gap-2"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="scim-key-name" className="text-xs text-muted-foreground">Key name</label>
        <Input
          id="scim-key-name"
          name="name"
          placeholder="Okta SCIM"
          required
          className="h-8 text-xs"
        />
      </div>
      <Button type="submit" size="sm">
        Create
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  )
}
