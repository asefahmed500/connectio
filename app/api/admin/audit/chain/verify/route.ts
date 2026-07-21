import { NextResponse, NextRequest } from 'next/server'
import { getCurrentUser } from '@/lib/dal/session'
import { checkSameOrigin } from '@/lib/auth/csrf'
import { verifyAuditChain, getChainDigest } from '@/lib/dal/audit-chain'

// Explicit auth at the route layer per AGENTS.md "API routes need explicit
// getCurrentUser() guard" — DAL also enforces requirePermission('audit:verify' /
// 'audit:read'), but this keeps the route's 401 behaviour explicit.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const digest = await getChainDigest()
  return NextResponse.json(digest)
}

export async function POST(req: NextRequest) {
  if (!checkSameOrigin(req.headers)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await verifyAuditChain()
  return NextResponse.json(result)
}
