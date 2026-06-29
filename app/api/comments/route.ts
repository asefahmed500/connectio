import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/dal/session'
import { getCommentsDTO } from '@/lib/dal/comments'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const clientId = url.searchParams.get('clientId')
  const submissionId = url.searchParams.get('submissionId') || undefined
  if (!clientId) return NextResponse.json({ error: 'Missing clientId' }, { status: 400 })

  const comments = await getCommentsDTO({ clientId, submissionId })
  return NextResponse.json(comments)
}
