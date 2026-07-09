import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/dal/session'
import { getSsoProvider } from '@/lib/dal/sso'
import { SsoProviderForm } from '../sso-provider-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata = { title: 'Edit SSO Provider — ClientConnect' }

export default async function EditSsoProviderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole('SUPER_ADMIN')
  const { id } = await params

  const provider = await getSsoProvider(id)
  if (!provider) notFound()

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const metadataUrl = `${baseUrl}/api/auth/sso/${id}/metadata`

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/sso" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; SSO Settings
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">{provider.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Endpoints</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">ACS URL (SAML):</span>
            <code className="ml-2 text-xs font-mono">
              {baseUrl}/api/auth/sso/{id}/acs
            </code>
          </div>
          {provider.providerType === 'saml' && (
            <div>
              <span className="text-muted-foreground">Metadata URL:</span>
              <code className="ml-2 text-xs font-mono">{metadataUrl}</code>
            </div>
          )}
          {provider.providerType === 'oidc' && (
            <div>
              <span className="text-muted-foreground">Callback URL:</span>
              <code className="ml-2 text-xs font-mono">
                {baseUrl}/api/auth/sso/{id}/callback
              </code>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Entity ID:</span>
            <code className="ml-2 text-xs font-mono">{provider.spEntityId}</code>
          </div>
          <div>
            <span className="text-muted-foreground">Users linked:</span>
            <span className="ml-2">{provider.userCount}</span>
          </div>
        </CardContent>
      </Card>

      <SsoProviderForm mode="edit" provider={provider} />
    </div>
  )
}
