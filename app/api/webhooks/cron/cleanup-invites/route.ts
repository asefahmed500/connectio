import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyBearerToken } from '@/lib/webhooks/auth'

export const dynamic = 'force-dynamic'

// Cron-driven: expires invites whose `expiresAt` has passed. Triggered by an
// external scheduler (e.g. Vercel Cron) that sends `Authorization: Bearer
// $CRON_SECRET`. Fail-closed everywhere.
export async function POST(request: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET
    if (!verifyBearerToken(request.headers.get('authorization'), secret)) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

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
