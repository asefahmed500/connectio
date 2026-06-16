import Link from 'next/link'
import {
  getDashboardStats,
  getStatusBreakdown,
  getSubmissionTrend,
  getRecentActivity,
  getTopClientsByActivity,
} from '@/lib/dal/analytics'
import { BarChart } from '@/components/analytics/bar-chart'
import { StatusBreakdown } from '@/components/analytics/status-breakdown'
import { ActivityFeed } from '@/components/analytics/activity-feed'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Mail, FileText, Clock, MessageSquare, Upload } from 'lucide-react'

export const metadata = { title: 'Admin dashboard — ClientConnect' }

const STAT_ICONS = {
  clients: Building2,
  invites: Mail,
  submissions: FileText,
  pending: Clock,
  comments: MessageSquare,
  files: Upload,
} as const

export default async function AdminDashboard() {
  const [stats, breakdown, trend, activity, topClients] = await Promise.all([
    getDashboardStats(),
    getStatusBreakdown(),
    getSubmissionTrend(14),
    getRecentActivity(15),
    getTopClientsByActivity(5),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading tracking-wide">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Activity across all clients. Last 14 days.
          </p>
        </div>
        <Link
          href="/admin/invites"
          className="text-sm text-primary hover:underline"
        >
          Manage invites →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat icon={STAT_ICONS.clients} label="Clients" value={stats.totalClients} sub={`+${stats.clientsThisMonth} this month`} />
        <Stat icon={STAT_ICONS.invites} label="Open invites" value={stats.openInvites} />
        <Stat icon={STAT_ICONS.submissions} label="Submissions" value={stats.totalSubmissions} />
        <Stat icon={STAT_ICONS.pending} label="Pending review" value={stats.pendingReview} highlight />
        <Stat icon={STAT_ICONS.comments} label="Comments" value={stats.totalComments} />
        <Stat icon={STAT_ICONS.files} label="Files" value={stats.totalFiles} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DashCard title="Submissions (14 days)">
          <BarChart data={trend.map((b) => ({ label: b.label, value: b.count }))} />
        </DashCard>
        <DashCard title="Submission status">
          <StatusBreakdown breakdown={breakdown} />
        </DashCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DashCard title="Recent activity" className="lg:col-span-2">
          <ActivityFeed items={activity} />
        </DashCard>
        <DashCard title="Top clients by activity">
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No clients yet.</p>
          ) : (
            <div className="divide-y">
              {topClients.map((c, i) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-muted-foreground tabular-nums w-4 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium hover:underline truncate"
                    >
                      {c.companyName}
                    </Link>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {c.submissions} sub · {c.comments} msg · {c.files} file
                    </span>
                    <span className="text-xs font-medium tabular-nums text-primary">
                      {c.activityScore}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DashCard>
      </div>
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  highlight,
}: {
  icon: React.ElementType
  label: string
  value: number
  sub?: string
  highlight?: boolean
}) {
  return (
    <Card className={highlight ? 'border-primary/50 bg-primary/5' : ''}>
      <CardHeader className="p-3 pb-1">
        <CardDescription className="flex items-center gap-1.5">
          <Icon className="size-3.5" />
          {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardHeader>
    </Card>
  )
}

function DashCard({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-heading tracking-wide">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
