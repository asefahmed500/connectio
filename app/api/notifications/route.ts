import { NextResponse } from 'next/server'
import { listNotifications } from '@/lib/dal/notifications'

export const runtime = 'nodejs'

export async function GET() {
  const result = await listNotifications({ limit: 30 })
  return NextResponse.json(result)
}
