import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/dal/session'
import { listAllClients } from '@/lib/dal/clients'
import { listUsers } from '@/lib/dal/users'
import { listAllTeamMembers } from '@/lib/dal/team'
import { listAllForms } from '@/lib/dal/forms'
import { rateLimit } from '@/lib/ratelimit'

const EXPORT_PAGE_SIZE = 500

export async function GET(req: Request) {
  // Export reveals the full client/team/form roster — SUPER_ADMIN only.
  await requireRole('SUPER_ADMIN')

  // Throttle expensive export queries.
  const rl = await rateLimit(`export:anon`, { limit: 30, window: 60 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many export requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type === 'clients') {
    const result = await listAllClients({ pageSize: EXPORT_PAGE_SIZE })
    return NextResponse.json({ items: result.items })
  }

  if (type === 'users') {
    const result = await listUsers({ pageSize: EXPORT_PAGE_SIZE })
    return NextResponse.json({ items: result.items })
  }

  if (type === 'team') {
    const result = await listAllTeamMembers({ pageSize: EXPORT_PAGE_SIZE })
    return NextResponse.json({ items: result.items })
  }

  if (type === 'forms') {
    const result = await listAllForms({ pageSize: EXPORT_PAGE_SIZE })
    return NextResponse.json({ items: result.items })
  }

  return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
}
