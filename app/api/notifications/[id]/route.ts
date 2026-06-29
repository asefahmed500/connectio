import { NextResponse } from 'next/server'
import { deleteNotification, markRead } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await deleteNotification(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[notifications] delete failed:', err)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
