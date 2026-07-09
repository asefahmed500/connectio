import { NextRequest, NextResponse } from 'next/server'
import { listErasureRequests, approveErasure, denyErasure } from '@/lib/dal/gdpr'

export async function GET() {
  const requests = await listErasureRequests()
  return NextResponse.json(requests)
}

export async function POST(req: NextRequest) {
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
