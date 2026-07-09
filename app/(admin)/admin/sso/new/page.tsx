import Link from 'next/link'
import { requireRole } from '@/lib/dal/session'
import { SsoProviderForm } from '../sso-provider-form'

export const metadata = { title: 'New SSO Provider — ClientConnect' }

export default async function NewSsoProviderPage() {
  await requireRole('SUPER_ADMIN')

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/sso" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; SSO Settings
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">Add SSO provider</h1>
        <p className="text-sm text-muted-foreground">
          Configure a SAML or OpenID Connect identity provider.
        </p>
      </div>
      <SsoProviderForm mode="create" />
    </div>
  )
}
