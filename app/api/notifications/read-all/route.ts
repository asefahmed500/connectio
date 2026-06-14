import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { markAllRead } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function POST() {
  await markAllRead()
  revalidatePath('/', 'layout')
  return NextResponse.json({ ok: true })
}
