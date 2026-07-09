import 'server-only'
import { createHmac, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'

export type WebhookEvent =
  | 'audit'
  | 'notification'
  | '*'

/**
 * Find all active webhooks subscribed to the given event and deliver the payload.
 * Runs asynchronously — does not block the caller.
 */
export async function dispatchWebhooks(
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const webhooks = await prisma.webhook.findMany({
      where: {
        isActive: true,
        OR: [
          { events: { has: event } },
          { events: { has: '*' } },
        ],
      },
    })

    if (webhooks.length === 0) return

    // Fire-and-forget: don't block the main flow
    for (const wh of webhooks) {
      deliverWebhook(wh, event, payload).catch((err) => {
        console.error(`[Webhook] Delivery to ${wh.url} failed:`, err)
      })
    }
  } catch (err) {
    console.error('[Webhook] dispatchWebhooks error:', err)
  }
}

async function deliverWebhook(
  wh: { id: string; url: string; secret: string | null; retryCount: number; timeoutSec: number },
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify({ event, payload, sentAt: new Date().toISOString() })
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'ClientConnect-Webhook/1.0',
  }

  // HMAC-SHA256 signature if secret is configured
  if (wh.secret) {
    const hmac = createHmac('sha256', wh.secret).update(body).digest('hex')
    headers['X-Signature-256'] = `sha256=${hmac}`
  }

  let lastError: string | null = null
  let lastStatus: number | null = null
  let lastBody: string | null = null

  for (let attempt = 1; attempt <= Math.max(wh.retryCount, 1); attempt++) {
    if (attempt > 1) {
      // Exponential backoff: 1s, 2s, 4s...
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 2)))
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), (wh.timeoutSec || 10) * 1000)

      const resp = await fetch(wh.url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })

      clearTimeout(timer)
      lastStatus = resp.status
      lastBody = await resp.text().catch(() => null)

      if (resp.ok) {
        // Success — record delivery and update last status
        await Promise.all([
          prisma.webhook.update({
            where: { id: wh.id },
            data: { lastDeliveredAt: new Date(), lastStatus, lastError: null },
          }),
          prisma.webhookDelivery.create({
            data: {
              webhookId: wh.id,
              event,
              payload: body as unknown as Prisma.InputJsonValue,
              status: lastStatus,
              responseBody: lastBody?.slice(0, 1000) ?? null,
              attempt,
              deliveredAt: new Date(),
            },
          }),
        ])
        return
      }

      // Non-ok status — continue to retry
      lastError = `HTTP ${resp.status}`
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      lastError = msg

      if (err instanceof DOMException && err.name === 'AbortError') {
        lastError = 'Request timed out'
      }
    }
  }

  // All retries exhausted — record failure
  await Promise.all([
    prisma.webhook.update({
      where: { id: wh.id },
      data: { lastStatus, lastError },
    }),
    prisma.webhookDelivery.create({
      data: {
        webhookId: wh.id,
        event,
        payload: body as unknown as Prisma.InputJsonValue,
        status: lastStatus,
        error: lastError?.slice(0, 500) ?? null,
        attempt: Math.max(wh.retryCount, 1),
      },
    }),
  ])
}
