import Link from 'next/link'
import { getCurrentUser } from '@/lib/dal/session'
import { listTeamAssignments } from '@/lib/dal/team'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'My clients — ClientConnect' }

export default async function TeamClientsPage() {
  const user = await getCurrentUser()
  if (!user?.teamMember) return null

  const assignments = await listTeamAssignments(user.teamMember.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">My clients</h1>
        <p className="text-sm text-muted-foreground">
          Clients assigned to you. Ask an admin if a client is missing.
        </p>
      </div>

      {assignments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            You have no assigned clients yet.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {assignments.map((a) => (
            <Card key={a.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Link
                      href={`/team/clients/${a.clientId}`}
                      className="font-medium hover:underline"
                    >
                      {a.companyName}
                    </Link>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {a.contactName} · /{a.uniqueSlug}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground text-right">
                    <div>{a.submissionsCount} submissions</div>
                    <div>{a.commentsCount} messages</div>
                    <div>{a.filesCount} files</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
