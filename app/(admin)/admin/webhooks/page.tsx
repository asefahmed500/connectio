import Link from 'next/link'
import { requirePermission } from '@/lib/auth/permissions'
import { listWebhooks } from '@/lib/dal/webhooks'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { WebhookActions } from './webhook-actions'

export const metadata = { title: 'Webhooks — ClientConnect' }

export default async function AdminWebhooksPage() {
  await requirePermission('settings:manage')

  const webhooks = await listWebhooks()

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading tracking-wide">Webhooks</h1>
          <p className="text-sm text-muted-foreground">
            Forward audit events and notifications to external endpoints.
          </p>
        </div>
        <Link
          href="/admin/webhooks/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Add webhook
        </Link>
      </div>

      {webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No webhooks configured. Add a webhook endpoint to forward events.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {webhooks.map((w) => (
            <Card key={w.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-heading tracking-wide">{w.name}</CardTitle>
                    <Badge variant={w.isActive ? 'default' : 'secondary'}>
                      {w.isActive ? 'Active' : 'Disabled'}
                    </Badge>
                    {w.lastStatus && (
                      <Badge variant={w.lastStatus < 400 ? 'default' : 'destructive'}>
                        {w.lastStatus}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {w.events.length === 1 && w.events[0] === '*' ? 'All events' : `${w.events.length} event(s)`}
                    </span>
                    <WebhookActions webhookId={w.id} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <div className="font-mono truncate">{w.url}</div>
                <div>
                  {w.deliveryCount} delivery(ies)
                  {w.lastDeliveredAt && (
                    <> &middot; Last: {w.lastDeliveredAt.toLocaleString()}</>
                  )}
                  {w.lastError && (
                    <> &middot; <span className="text-destructive">{w.lastError}</span></>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
