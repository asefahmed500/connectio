import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getTeamMemberDTO } from '@/lib/dal/team'
import { AssignClientForm } from './assign-form'
import { UnassignButton } from './unassign-button'

export const metadata = { title: 'Team member — ClientConnect' }

export default async function TeamMemberDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const member = await getTeamMemberDTO(id)
  if (!member) notFound()

  // All clients not currently assigned — for the assignment dropdown.
  const unassigned = await prisma.client.findMany({
    where: { deletedAt: null, assignments: { none: { teamMemberId: id } } },
    orderBy: { companyName: 'asc' },
    select: { id: true, companyName: true, uniqueSlug: true },
  })

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/admin/team" className="text-sm text-muted-foreground hover:text-foreground">
          ← All team members
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">{member.name}</h1>
        <p className="text-sm text-muted-foreground">
          {member.email}{member.department ? ` · ${member.department}` : ''}
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Assigned clients</h2>
        {member.assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-3">No clients assigned yet.</p>
        ) : (
          <ul className="space-y-2 mb-3">
            {member.assignments.map((c) => (
              <li
                key={c.id}
                className="border rounded p-3 flex justify-between items-center"
              >
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
              </li>
            ))}
          </ul>
        )}

        {unassigned.length > 0 && <AssignClientForm teamMemberId={member.id} clients={unassigned} />}
      </div>
    </div>
  )
}
