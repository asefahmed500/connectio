import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/dal/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    })
  } catch (err) {
    console.error('[session] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
