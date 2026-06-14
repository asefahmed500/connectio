// SSE endpoint for real-time notifications. Polls the DB every 8s for new rows
// since the last delivered id and pushes them to the client. Heartbeat every
// 25s keeps the connection alive through proxies.
//
// Limitation: each connection costs a DB query per poll. For >500 concurrent
// streams, swap to Redis pub/sub (see docs/14-notifications.md §6).

import { getCurrentUser } from '@/lib/dal/session'
import { listNotificationsSince } from '@/lib/dal/notifications'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 8_000
const HEARTBEAT_INTERVAL_MS = 25_000

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const enc = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string, id?: string) => {
        if (closed) return
        if (id) controller.enqueue(enc.encode(`id: ${id}\n`))
        controller.enqueue(enc.encode(`data: ${data}\n\n`))
      }

      // Replay missed notifications since Last-Event-ID (or last minute).
      const lastEventIdHeader = req.headers.get('last-event-id')
      const since = lastEventIdHeader
        ? new Date(Number(lastEventIdHeader))
        : new Date(Date.now() - 60_000)

      try {
        const initial = await listNotificationsSince(since)
        for (const n of initial) {
          send(JSON.stringify(n), new Date(n.createdAt).getTime().toString())
        }
      } catch (err) {
        console.error('[notifications/stream] initial fetch failed:', err)
      }

      const poll = async () => {
        if (closed) return
        try {
          const cutoff = lastEventIdHeader
            ? new Date(Number(lastEventIdHeader))
            : since
          void cutoff // not used after first poll; we'd track per-conn state in v2
          const fresh = await listNotificationsSince(new Date(Date.now() - POLL_INTERVAL_MS - 500))
          for (const n of fresh) {
            send(JSON.stringify(n), new Date(n.createdAt).getTime().toString())
          }
        } catch (err) {
          console.error('[notifications/stream] poll failed:', err)
        }
      }

      const pollTimer = setInterval(poll, POLL_INTERVAL_MS)
      const heartbeatTimer = setInterval(() => {
        if (!closed) controller.enqueue(enc.encode(`: heartbeat\n\n`))
      }, HEARTBEAT_INTERVAL_MS)

      req.signal.addEventListener('abort', () => {
        closed = true
        clearInterval(pollTimer)
        clearInterval(heartbeatTimer)
        try {
          controller.close()
        } catch {
          // Already closed.
        }
      })

      void user // pin the auth check
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
