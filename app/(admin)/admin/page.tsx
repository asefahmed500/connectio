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

export const metadata = { title: 'Admin dashboard — ClientConnect' }

export default async function AdminDashboard() {
  const [stats, breakdown, trend, activity, topClients] = await Promise.all([
    getDashboardStats(),
    getStatusBreakdown(),
    getSubmissionTrend(14),
    getRecentActivity(15),
    getTopClientsByActivity(5),
  ])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Stat label="Clients" value={stats.totalClients} sub={`+${stats.clientsThisMonth} this month`} />
        <Stat label="Open invites" value={stats.openInvites} />
        <Stat label="Submissions" value={stats.totalSubmissions} />
        <Stat label="Pending review" value={stats.pendingReview} highlight={stats.pendingReview > 0} />
        <Stat label="Comments" value={stats.totalComments} />
        <Stat label="Files" value={stats.totalFiles} />
      </div>

      {/* Trend + status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Submissions (14 days)">
          <BarChart data={trend.map((b) => ({ label: b.label, value: b.count }))} />
        </Card>
        <Card title="Submission status">
          <StatusBreakdown breakdown={breakdown} />
        </Card>
      </div>

      {/* Activity + top clients */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Recent activity" className="lg:col-span-2">
          <ActivityFeed items={activity} />
        </Card>
        <Card title="Top clients by activity">
          {topClients.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No clients yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {topClients.map((c, i) => (
                <li key={c.id} className="flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <span className="text-muted-foreground mr-2">{i + 1}</span>
                    <Link
                      href={`/admin/clients/${c.id}`}
                      className="font-medium hover:underline truncate"
                    >
                      {c.companyName}
                    </Link>
                    <div className="text-xs text-muted-foreground pl-6">
                      {c.submissions} sub · {c.comments} msg · {c.files} file
                    </div>
                  </div>
                  <span className="text-xs font-medium tabular-nums shrink-0">
                    {c.activityScore}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string
  value: number
  sub?: string
  highlight?: boolean
}) {
  return (
    <div
      className={`border rounded-lg p-3 ${
        highlight ? 'border-primary/50 bg-primary/5' : ''
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold mt-0.5 tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}

function Card({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={`border rounded-lg p-4 ${className ?? ''}`}>
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </div>
  )
}
