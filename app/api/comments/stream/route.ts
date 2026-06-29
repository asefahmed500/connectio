import { getCurrentUser } from '@/lib/dal/session'
import { listCommentsSince } from '@/lib/dal/comments'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POLL_INTERVAL_MS = 3_000
const HEARTBEAT_INTERVAL_MS = 15_000

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const clientId = url.searchParams.get('clientId')
    const submissionId = url.searchParams.get('submissionId') || undefined
    if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

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
          : new Date(Date.now() - 10_000)

        const poll = async () => {
          if (closed) return
          try {
            const currentUser = await getCurrentUser()
            if (!currentUser || currentUser.id !== user.id) {
              closed = true
              controller.enqueue(enc.encode(`event: close\ndata: session expired\n\n`))
              try { controller.close() } catch { /* already closed */ }
              return
            }
            const fresh = await listCommentsSince({ clientId, since: lastSentAt, submissionId })
            for (const c of fresh) {
              send(JSON.stringify(c), new Date(c.createdAt).getTime().toString())
              const ts = new Date(c.createdAt)
              if (ts > lastSentAt) lastSentAt = ts
            }
          } catch (err) {
            console.error('[comments/stream] poll failed:', err)
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
          try { controller.close() } catch { /* already closed */ }
        })
      },
      cancel() { closed = true },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    console.error('[comments/stream] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
