import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/dal/session'
import { listAllClients } from '@/lib/dal/clients'
import { listUsers } from '@/lib/dal/users'
import { listAllTeamMembers } from '@/lib/dal/team'
import { listAllForms } from '@/lib/dal/forms'

export async function GET(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type === 'clients') {
    const result = await listAllClients({ pageSize: 9999 })
    return NextResponse.json({ items: result.items })
  }

  if (type === 'users') {
    const result = await listUsers({ pageSize: 9999 })
    return NextResponse.json({ items: result.items })
  }

  if (type === 'team') {
    const result = await listAllTeamMembers({ pageSize: 9999 })
    return NextResponse.json({ items: result.items })
  }

  if (type === 'forms') {
    const result = await listAllForms({ pageSize: 9999 })
    return NextResponse.json({ items: result.items })
  }

  return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
}
