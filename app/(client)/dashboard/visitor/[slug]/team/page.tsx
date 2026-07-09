import { requireClientAccessBySlug } from '@/lib/dal/session'
import { listAssignedTeamMembers } from '@/lib/dal/team'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { UsersRound, Mail, Building2 } from 'lucide-react'

export const metadata = { title: 'Your team — ClientConnect' }

export default async function ClientTeamPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)

  const members = await listAssignedTeamMembers(clientId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Your team</h1>
        <p className="text-sm text-muted-foreground">
          Team members assigned to support your account.
        </p>
      </div>

      {members.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <UsersRound className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>No team members assigned yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <Card key={m.id}>
              <CardHeader>
                <CardTitle className="text-base">{m.name}</CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3 w-3" />
                    {m.email}
                  </span>
                  {m.department && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" />
                      {m.department}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
