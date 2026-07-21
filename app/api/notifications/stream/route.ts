// SSE endpoint for real-time notifications. Polls the DB every 8s and pushes
// new rows since the last delivered timestamp. Each connection tracks its own
// cursor so polls only fetch new notifications, avoiding overlap with the
// initial replay. Heartbeat every 25s keeps the connection alive through
// proxies.
//
// Limitation: each connection costs a DB query per poll. For >500 concurrent
// streams, swap to Redis pub/sub (see docs/14-notifications.md §6).

import { getCurrentUser } from '@/lib/dal/session'
import { listNotificationsSince } from '@/lib/dal/notifications'
import {
  acquireConnectionSlot,
  releaseConnectionSlot,
  DEFAULT_MAX_STREAMS_PER_USER,
} from '@/lib/concurrency'
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

  // Cap concurrent SSE streams per user — defends against a single user
  // (or a small botnet of valid sessions) exhausting the connection pool
  // and DB CPU by opening hundreds of polling streams.
  const slotKey = `sse:user:${user.id}`
  if (!acquireConnectionSlot(slotKey, DEFAULT_MAX_STREAMS_PER_USER)) {
    return new NextResponse('Too many concurrent streams', {
      status: 429,
      headers: { 'Retry-After': '30' },
    })
  }

  const enc = new TextEncoder()
  let closed = false
  let lastSentAt: Date

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: string, id?: string) => {
        if (closed) return
        if (id) controller.enqueue(enc.encode(`id: ${id}\n`))
        controller.enqueue(enc.encode(`data: ${data}\n\n`))
      }

      const lastEventIdHeader = req.headers.get('last-event-id')
      const timestamp = Number(lastEventIdHeader)
      lastSentAt = Number.isFinite(timestamp) && timestamp > 0
        ? new Date(timestamp)
        : new Date(Date.now() - 60_000)

      try {
        const initial = await listNotificationsSince(lastSentAt)
        for (const n of initial) {
          send(JSON.stringify(n), new Date(n.createdAt).getTime().toString())
          const ts = new Date(n.createdAt)
          if (ts > lastSentAt) lastSentAt = ts
        }
      } catch (err) {
        console.error('[notifications/stream] initial fetch failed:', err)
      }

      const poll = async () => {
        if (closed) return
        try {
          const currentUser = await getCurrentUser()
          if (!currentUser || currentUser.id !== user.id) {
            closed = true
            controller.enqueue(enc.encode(`event: close\ndata: session expired\n\n`))
            clearInterval(pollTimer)
            clearInterval(heartbeatTimer)
            releaseConnectionSlot(slotKey)
            try { controller.close() } catch { /* already closed */ }
            return
          }
          const fresh = await listNotificationsSince(lastSentAt)
          for (const n of fresh) {
            send(JSON.stringify(n), new Date(n.createdAt).getTime().toString())
            const ts = new Date(n.createdAt)
            if (ts > lastSentAt) lastSentAt = ts
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
        releaseConnectionSlot(slotKey)
        try { controller.close() } catch { /* already closed */ }
      })
    },
    cancel() {
      closed = true
      releaseConnectionSlot(slotKey)
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
