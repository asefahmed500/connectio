import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/permissions'
import { getWebhook, listWebhookDeliveries } from '@/lib/dal/webhooks'
import { WebhookForm } from '../webhook-form'
import { WebhookDetailActions } from './detail-actions'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Webhook — ClientConnect' }

export default async function EditWebhookPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('settings:manage')
  const { id } = await params

  const webhook = await getWebhook(id).catch(() => null)
  if (!webhook) notFound()

  const { items: deliveries } = await listWebhookDeliveries(id, 1, 50)

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div>
        <Link href="/admin/webhooks" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Webhooks
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">{webhook.name}</h1>
      </div>

      <WebhookForm mode="edit" webhook={webhook} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-heading tracking-wide">Delivery log</CardTitle>
            <WebhookDetailActions webhookId={webhook.id} />
          </div>
        </CardHeader>
        <CardContent>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No deliveries yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {deliveries.map((d: Record<string, unknown>) => (
                <div
                  key={d.id as string}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        d.status && (d.status as number) < 400
                          ? 'default'
                          : d.status
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {d.status ? String(d.status) : 'FAILED'}
                    </Badge>
                    <span className="font-mono">{d.event as string}</span>
                    <span className="text-muted-foreground">
                      Attempt {d.attempt as string}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {d.error ? (
                      <span className="text-destructive">
                        {(d.error as string).slice(0, 80)}
                      </span>
                    ) : null}
                    <span>
                      {d.deliveredAt
                        ? new Date(d.deliveredAt as string).toLocaleString()
                        : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
