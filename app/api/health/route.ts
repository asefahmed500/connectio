import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  let db: 'up' | 'down' = 'up'
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    db = 'down'
  }

  return NextResponse.json({ ok: true, time: new Date().toISOString(), db })
}
