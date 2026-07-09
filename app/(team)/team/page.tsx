import Link from 'next/link'
import { getCurrentUser } from '@/lib/dal/session'
import { listTeamAssignments } from '@/lib/dal/team'
import {
  getTeamDashboardStats,
  getTeamSubmissionTrend,
  getTeamStatusBreakdown,
  getTeamRecentActivity,
} from '@/lib/dal/analytics'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { BarChart } from '@/components/analytics/bar-chart'
import { StatusBreakdown } from '@/components/analytics/status-breakdown'
import { ActivityFeed } from '@/components/analytics/activity-feed'
import { Building2, FileText, MessageSquare, Upload, ArrowUpRight, Clock, CalendarDays } from 'lucide-react'

export const metadata = { title: 'Team dashboard — ClientConnect' }

export default async function TeamDashboard() {
  const user = await getCurrentUser()
  if (!user?.teamMember) return null

  const teamMemberId = user.teamMember.id

  const [stats, trend, breakdown, activity, assignments] = await Promise.all([
    getTeamDashboardStats(teamMemberId),
    getTeamSubmissionTrend(teamMemberId, 14),
    getTeamStatusBreakdown(teamMemberId),
    getTeamRecentActivity(teamMemberId, 10),
    listTeamAssignments(teamMemberId),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of your assigned clients and their activity.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Building2 className="size-3.5" />
              Clients
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.totalClients}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Submissions
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.totalSubmissions}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Pending review
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.pendingReview}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              This month
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.submissionsThisMonth}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Messages
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.totalComments}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Upload className="size-3.5" />
              Files
            </CardDescription>
            <CardTitle className="text-xl tabular-nums">{stats.totalFiles}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Submission trend (14 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={trend.map((d) => ({ label: d.label, value: d.count }))}
              emptyLabel="No submissions in the last 14 days"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusBreakdown breakdown={breakdown} />
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={activity} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Quick stats</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Clients</span>
              <span className="font-medium tabular-nums">{stats.totalClients}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending review</span>
              <span className="font-medium tabular-nums">{stats.pendingReview}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">This month</span>
              <span className="font-medium tabular-nums">{stats.submissionsThisMonth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Submissions/client</span>
              <span className="font-medium tabular-nums">
                {stats.totalClients > 0 ? (stats.totalSubmissions / stats.totalClients).toFixed(1) : '—'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client list */}
      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Assigned clients</h2>
        {assignments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              You have no assigned clients yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
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
                          {a.contactName && <span className="text-muted-foreground ml-3">&middot; {a.contactName}</span>}
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
    </div>
  )
}
