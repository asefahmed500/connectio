import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const result = await prisma.invite.updateMany({
      where: {
        status: 'OPEN',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'EXPIRED' },
    })

    return NextResponse.json({ ok: true, expired: result.count })
  } catch (err) {
    console.error('[webhook:cron:cleanup-invites] Failed:', err)
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 })
  }
}
