import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/dal/session'
import { checkSameOrigin } from '@/lib/auth/csrf'
import { markAllRead } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!checkSameOrigin(req.headers)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await markAllRead()
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications] markAllRead failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
