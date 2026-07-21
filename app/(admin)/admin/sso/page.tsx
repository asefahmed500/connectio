import Link from 'next/link'
import { requireRole } from '@/lib/dal/session'
import { listSsoProviders, listScimApiKeys } from '@/lib/dal/sso'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SsoProviderActions } from './sso-provider-actions'
import { ScimApiKeysSection } from './scim-keys'

export const metadata = { title: 'SSO — ClientConnect' }

export default async function AdminSsoPage() {
  await requireRole('SUPER_ADMIN')

  const providers = await listSsoProviders()
  const scimKeys = await listScimApiKeys()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading tracking-wide">SSO / SCIM</h1>
          <p className="text-sm text-muted-foreground">
            Configure single sign-on and SCIM provisioning.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/sso/new">Add provider</Link>
        </Button>
      </div>

      {providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No SSO providers configured. Add a SAML or OIDC provider to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {providers.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-heading tracking-wide">{p.name}</CardTitle>
                    <Badge variant={p.isActive ? 'default' : 'secondary'}>
                      {p.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                    <Badge variant="outline">{p.providerType.toUpperCase()}</Badge>
                  </div>
                  <SsoProviderActions providerId={p.id} />
                </div>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Entity ID</dt>
                    <dd className="font-mono text-xs">{p.spEntityId}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">JIT provisioning</dt>
                    <dd>{p.jitProvisioning ? 'Enabled' : 'Disabled'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Default role</dt>
                    <dd>{p.defaultRole}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Users linked</dt>
                    <dd>{p.userCount}</dd>
                  </div>
                </dl>

                {p.userCount === 0 && (
                  <div className="flex items-center gap-2 mt-3">
                    <a
                      href={`/api/auth/sso/${p.id}/metadata`}
                      download
                      className="text-xs text-primary hover:underline"
                    >
                      Download SP metadata
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ScimApiKeysSection keys={scimKeys} />
    </div>
  )
}
