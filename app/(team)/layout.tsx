import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/dal/session'
import { TeamShell } from './team-shell'

export default async function TeamLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('TEAM_MEMBER')
  if (!user.teamMember) redirect('/login')

  return (
    <TeamShell user={{ email: user.email, name: user.name }}>{children}</TeamShell>
  )
}
