import { requirePermission } from '@/lib/auth/permissions'
import { listApiKeys } from '@/lib/dal/api-keys'
import { createKeyAction } from './actions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ApiKeyActions } from './api-key-actions'

export const metadata = { title: 'API Keys — ClientConnect' }

export default async function ApiKeysPage() {
  await requirePermission('settings:manage')
  const keys = await listApiKeys()

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
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
              <CardContent className="text-xs text-muted-foreground space-y-1">
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
      className="flex gap-3 items-center"
    >
      <input
        name="name"
        type="text"
        required
        placeholder="Key name"
        className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex-1"
      />
      <input
        name="permissions"
        type="text"
        placeholder="read:*"
        className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      />
      <button
        type="submit"
        className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
      >
        Create key
      </button>
    </form>
  )
}
