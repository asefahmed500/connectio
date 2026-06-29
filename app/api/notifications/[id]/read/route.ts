import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/dal/session'
import { markRead } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await markRead(id)
    revalidatePath('/', 'layout')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[notifications] markRead failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
