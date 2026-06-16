import Link from 'next/link'
import { getCurrentUser } from '@/lib/dal/session'
import { listTeamAssignments } from '@/lib/dal/team'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Building2, FileText, MessageSquare, Upload, ArrowUpRight } from 'lucide-react'

export const metadata = { title: 'Team dashboard — ClientConnect' }

export default async function TeamDashboard() {
  const user = await getCurrentUser()
  if (!user?.teamMember) return null

  const assignments = await listTeamAssignments(user.teamMember.id)

  const totalClients = assignments.length
  const totalSubmissions = assignments.reduce((s, a) => s + a.submissionsCount, 0)
  const totalMessages = assignments.reduce((s, a) => s + a.commentsCount, 0)
  const totalFiles = assignments.reduce((s, a) => s + a.filesCount, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Your clients</h1>
        <p className="text-sm text-muted-foreground">
          Clients assigned to you. Contact an admin to be assigned to more.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              Clients
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{totalClients}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Submissions
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{totalSubmissions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Messages
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{totalMessages}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Upload className="size-3.5" />
              Files
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{totalFiles}</CardTitle>
          </CardHeader>
        </Card>
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
            <Card key={a.id} className="hover:border-foreground/20 transition-colors">
              <Link href={`/team/clients/${a.clientId}`} className="block">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-base font-medium flex items-center gap-2">
                        {a.companyName}
                        <ArrowUpRight className="size-3.5 text-muted-foreground shrink-0" />
                      </CardTitle>
                      <CardDescription className="text-xs font-mono">
                        /{a.uniqueSlug}
                        {a.contactName && <span className="text-muted-foreground ml-3">· {a.contactName}</span>}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums shrink-0">
                      <span>{a.submissionsCount} sub</span>
                      <span>{a.commentsCount} msg</span>
                      <span>{a.filesCount} file</span>
                    </div>
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
