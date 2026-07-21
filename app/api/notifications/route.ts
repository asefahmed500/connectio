import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/dal/session'
import { checkSameOrigin } from '@/lib/auth/csrf'
import { listNotifications, searchNotifications, deleteAllNotifications } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

export async function DELETE(req: Request) {
  if (!checkSameOrigin(req.headers)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await deleteAllNotifications()
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[notifications] deleteAll failed:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
