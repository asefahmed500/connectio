import Link from 'next/link'
import { getCurrentUser } from '@/lib/dal/session'
import { prisma } from '@/lib/db'

export const metadata = { title: 'My clients — ClientConnect' }

export default async function TeamClientsPage() {
  const user = await getCurrentUser()
  if (!user?.teamMember) return null

  const assignments = await prisma.teamAssignment.findMany({
    where: { teamMemberId: user.teamMember.id },
    include: {
      client: {
        select: {
          id: true,
          companyName: true,
          uniqueSlug: true,
          contactName: true,
          _count: { select: { submissions: true, comments: true, files: true } },
        },
      },
    },
    orderBy: { assignedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My clients</h1>
        <p className="text-sm text-muted-foreground">
          Clients assigned to you. Ask an admin if a client is missing.
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">You have no assigned clients yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {assignments.map((a) => (
            <li key={a.id} className="border rounded-lg p-4">
              <div className="flex justify-between items-start">
                <div>
                  <Link
                    href={`/team/clients/${a.client.id}`}
                    className="font-medium hover:underline"
                  >
                    {a.client.companyName}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.client.contactName} · /{a.client.uniqueSlug}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{a.client._count.submissions} submissions</div>
                  <div>{a.client._count.comments} messages</div>
                  <div>{a.client._count.files} files</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
