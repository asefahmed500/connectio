import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { markRead } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
