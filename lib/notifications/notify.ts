import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { computeRecipients } from './audience'
import { renderTemplate } from './templates'
import type { NotificationEvent } from './types'

/**
 * Emits a notification event: computes recipients, writes a Notification row
 * per recipient, bumps unread counts. Idempotent at the row level (duplicates
 * are acceptable in v1 — the dedupe happens at the email layer).
 *
 * The transaction covers notifications + user updates so a partial failure
 * can't leave counts out of sync.
 */
export async function notify(event: NotificationEvent): Promise<void> {
  const recipientIds = await computeRecipients(event)
  if (recipientIds.length === 0) return

  const tpl = renderTemplate(event)
  const now = new Date()

  await prisma.$transaction(async (tx) => {
    await tx.notification.createMany({
      data: recipientIds.map((recipientId) => ({
        recipientId,
        type: event.type,
        clientId: 'clientId' in event ? event.clientId : null,
        submissionId: 'submissionId' in event ? event.submissionId ?? null : null,
        commentId: 'commentId' in event ? event.commentId : null,
        title: tpl.title,
        body: tpl.body,
        href: tpl.href,
        payload: event as unknown as Prisma.InputJsonValue,
      })),
    })

    await tx.user.updateMany({
      where: { id: { in: recipientIds } },
      data: { unreadNotifications: { increment: 1 } },
    })
  })

  // Email side-channel — fire and forget. When the email milestone lands
  // this becomes after() + lib/email.
  if (tpl.emailByDefault) {
    void sendEmails(event, recipientIds).catch((err) => {
      console.error('[notify] email batch failed:', err)
    })
  }
}

async function sendEmails(_event: NotificationEvent, _recipientIds: string[]) {
  // Stub: replaced by the email adapter in a later milestone. In dev this
  // would log to console; in prod it would enqueue via the outbox.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[email stub] would notify ${_recipientIds.length} recipient(s) of ${_event.type}`)
  }
}
