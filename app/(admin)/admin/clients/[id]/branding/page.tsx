import Link from 'next/link'
import { requirePermission } from '@/lib/auth/permissions'
import { getClientSettings } from '@/lib/dal/client-settings'
import { getClientDTO } from '@/lib/dal/clients'
import { notFound } from 'next/navigation'
import { BrandingForm } from './branding-form'

export const metadata = { title: 'Client Branding — ClientConnect' }

export default async function ClientBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('client:update')
  const { id } = await params

  const client = await getClientDTO(id)
  if (!client) notFound()

  const settings = await getClientSettings(id)

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link
          href={`/admin/clients/${id}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {client.companyName}
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">
          Portal branding
        </h1>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of the client portal for this client.
        </p>
      </div>

      <BrandingForm clientId={id} settings={settings ?? undefined} />
    </div>
  )
}
