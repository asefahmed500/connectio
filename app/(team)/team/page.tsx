import { getCurrentUser } from '@/lib/dal/session'
import { prisma } from '@/lib/db'

export const metadata = { title: 'Team dashboard — ClientConnect' }

export default async function TeamDashboard() {
  const user = await getCurrentUser()
  if (!user?.teamMember) return null

  const assignments = await prisma.teamAssignment.findMany({
    where: { teamMemberId: user.teamMember.id },
    include: { client: { select: { companyName: true, uniqueSlug: true } } },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your clients</h1>
        <p className="text-sm text-muted-foreground">
          Clients assigned to you. Contact an admin to be assigned to more.
        </p>
      </div>
      {assignments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          You have no assigned clients yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {assignments.map((a) => (
            <li key={a.id} className="border rounded-lg p-3">
              <div className="font-medium">{a.client.companyName}</div>
              <div className="text-xs text-muted-foreground font-mono">
                {a.client.uniqueSlug}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
