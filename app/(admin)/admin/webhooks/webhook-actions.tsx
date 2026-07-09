'use client'

import Link from 'next/link'
import { deleteWebhookAction } from './actions'
import { Button } from '@/components/ui/button'
import { Edit3, Trash2 } from 'lucide-react'

export function WebhookActions({ webhookId }: { webhookId: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={`/admin/webhooks/${webhookId}`}>
        <Button variant="ghost" size="icon-sm">
          <Edit3 className="w-3 h-3" />
        </Button>
      </Link>
      <form action={deleteWebhookAction.bind(null, webhookId)}>
        <Button variant="ghost" size="icon-sm" type="submit">
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </form>
    </div>
  )
}
