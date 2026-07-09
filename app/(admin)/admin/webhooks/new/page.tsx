import Link from 'next/link'
import { requirePermission } from '@/lib/auth/permissions'
import { WebhookForm } from '../webhook-form'

export const metadata = { title: 'New Webhook — ClientConnect' }

export default async function NewWebhookPage() {
  await requirePermission('settings:manage')

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/webhooks" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Webhooks
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">New webhook</h1>
      </div>
      <WebhookForm mode="create" />
    </div>
  )
}
