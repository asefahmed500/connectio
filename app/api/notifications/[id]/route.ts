import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/dal/session'
import { deleteNotification } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    await deleteNotification(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[notifications] delete failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
