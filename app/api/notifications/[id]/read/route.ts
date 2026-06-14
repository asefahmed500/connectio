import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { markRead } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await markRead(id)
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true })
}
