import { NextResponse } from 'next/server'
import { listNotifications, searchNotifications, deleteAllNotifications } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('q') || undefined
    const type = url.searchParams.get('type') || undefined
    const read = url.searchParams.get('read') || undefined

    const result = query || type || read
      ? await searchNotifications({ query, type, read })
      : await listNotifications({ limit: 30 })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[notifications] list failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    await deleteAllNotifications()
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[notifications] deleteAll failed:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
