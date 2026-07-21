import { requirePermission } from '@/lib/auth/permissions'
import { listApiKeys } from '@/lib/dal/api-keys'
import { createKeyAction } from './actions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { ApiKeyActions } from './api-key-actions'

export const metadata = { title: 'API Keys — ClientConnect' }

export default async function ApiKeysPage() {
  await requirePermission('settings:manage')
  const keys = await listApiKeys()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">API Keys</h1>
        <p className="text-sm text-muted-foreground">
          Manage programmatic access tokens for external integrations.
        </p>
      </div>

      <Card>
        <CardContent className="p-3">
          <CreateKeyForm />
        </CardContent>
      </Card>

      {keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No API keys created yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {keys.map((k) => (
            <Card key={k.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-heading tracking-wide">{k.name}</CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">{k.prefix}…</Badge>
                    <Badge variant={k.isActive ? 'default' : 'secondary'}>
                      {k.isActive ? 'Active' : 'Revoked'}
                    </Badge>
                  </div>
                  <ApiKeyActions keyId={k.id} isActive={k.isActive} />
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground flex flex-col gap-1">
                {k.permissions.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    Permissions:
                    {k.permissions.map((p) => (
                      <Badge key={p} variant="secondary" className="text-[10px] font-mono">{p}</Badge>
                    ))}
                  </div>
                )}
                {k.lastUsedAt && <div>Last used: {k.lastUsedAt.toLocaleString()}</div>}
                {k.expiresAt && <div>Expires: {k.expiresAt.toLocaleString()}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CreateKeyForm() {
  return (
    <form
      action={createKeyAction}
      className="flex flex-col sm:flex-row gap-3 sm:items-end"
    >
      <Field className="flex-1">
        <FieldLabel htmlFor="name">Key name</FieldLabel>
        <Input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Production read-only key"
        />
      </Field>
      <Field className="flex-1">
        <FieldLabel htmlFor="permissions">Permissions (space-separated)</FieldLabel>
        <Input
          id="permissions"
          name="permissions"
          type="text"
          placeholder="read:submissions"
        />
      </Field>
      <Button type="submit" className="sm:shrink-0">
        Create key
      </Button>
    </form>
  )
}
