import { NextResponse } from 'next/server'
import { listNotifications } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await listNotifications({ limit: 30 })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[notifications] list failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
