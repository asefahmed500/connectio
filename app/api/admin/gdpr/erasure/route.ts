import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/dal/session'
import { checkSameOrigin } from '@/lib/auth/csrf'
import { listErasureRequests, approveErasure, denyErasure } from '@/lib/dal/gdpr'

// Explicit auth at the route layer per AGENTS.md "API routes need explicit
// getCurrentUser() guard" — DAL also enforces requirePermission('gdpr:manage'),
// but the belt-and-braces check here ensures the route returns a clean 401 even
// if the DAL silently returns empty for unauthenticated users.
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const requests = await listErasureRequests()
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
  if (!checkSameOrigin(req.headers)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, requestId, reason } = body

  if (!requestId || !['approve', 'deny'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid request. Required: action (approve|deny), requestId' },
      { status: 400 },
    )
  }

  if (action === 'approve') {
    await approveErasure(requestId)
  } else {
    await denyErasure(requestId, reason)
  }

  return NextResponse.json({ success: true })
}
