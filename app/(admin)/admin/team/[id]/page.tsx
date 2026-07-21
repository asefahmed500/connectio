import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTeamMemberDTO, listUnassignedClients } from '@/lib/dal/team'
import { AssignClientForm } from './assign-form'
import { UnassignButton } from './unassign-button'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Team member — ClientConnect' }

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const member = await getTeamMemberDTO(id)
  if (!member) notFound()

  const unassigned = await listUnassignedClients(id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/team" className="text-sm text-muted-foreground hover:text-foreground">
          ← All team members
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">{member.name}</h1>
        <p className="text-sm text-muted-foreground">
          {member.email}{member.department ? ` · ${member.department}` : ''}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Assigned clients</h2>
        {member.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-3">No clients assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-2 mb-3">
            {member.assignments.map((c) => (
              <Card key={c.id}>
                <CardContent className="p-3 flex justify-between items-center">
                  <div>
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.companyName}
                    </Link>
                    <div className="text-xs text-muted-foreground font-mono">{c.uniqueSlug}</div>
                  </div>
                  <UnassignButton teamMemberId={member.id} clientId={c.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {unassigned.length > 0 && <AssignClientForm teamMemberId={member.id} clients={unassigned} />}
      </div>
    </div>
  )
}
