import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { requireClientAccessBySlug } from '@/lib/dal/session'
import { listSubmissionsForClient } from '@/lib/dal/submissions'
import { countComments } from '@/lib/dal/comments'
import { listFilesForClient } from '@/lib/dal/files'
import {
  getClientDashboardStats,
  getClientSubmissionTrend,
  getClientStatusBreakdown,
  getClientRecentActivity,
} from '@/lib/dal/analytics'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { StatusBreakdown } from '@/components/analytics/status-breakdown'
import { BarChart } from '@/components/analytics/bar-chart'
import { ActivityFeed } from '@/components/analytics/activity-feed'
import { FileText, MessageSquare, Upload, Search, Filter, Clock } from 'lucide-react'

export const metadata = { title: 'My dashboard — ClientConnect' }

function statusBadge(status: string) {
  switch (status) {
    case 'APPROVED':
      return <Badge variant="default" className="bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/15 border-0">Approved</Badge>
    case 'SUBMITTED':
      return <Badge variant="secondary">Submitted</Badge>
    case 'IN_REVIEW':
      return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50">In review</Badge>
    case 'CHANGES_REQUESTED':
      return <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50">Changes</Badge>
    case 'REJECTED':
      return <Badge variant="destructive">Rejected</Badge>
    default:
      return <Badge variant="outline">Draft</Badge>
  }
}

export default async function ClientDashboard({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ search?: string; status?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const clientId = await requireClientAccessBySlug(slug)

  const [stats, trend, breakdown, activity, submissions, comments, files] = await Promise.all([
    getClientDashboardStats(clientId),
    getClientSubmissionTrend(clientId, 12),
    getClientStatusBreakdown(clientId),
    getClientRecentActivity(clientId, 10),
    listSubmissionsForClient(clientId, { search: sp.search, status: sp.status }),
    countComments(clientId, false),
    listFilesForClient(clientId),
  ])

  const items = submissions.items

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track your submissions and feedback here.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Submissions
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.totalSubmissions}</CardTitle>
          </CardHeader>
        </Card>
        <Card className={stats.pendingReview > 0 ? 'border-primary/50 bg-primary/5' : ''}>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Clock className="size-3.5" />
              Pending review
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.pendingReview}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Comments
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.totalComments}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Upload className="size-3.5" />
              Files
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{stats.totalFiles}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Submission trend (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={trend.map((d) => ({ label: d.label, value: d.count }))}
              emptyLabel="No submissions this year"
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

      {/* Activity + Submissions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Your submissions</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <form className="flex gap-3 flex-wrap items-center mb-4">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="search" defaultValue={sp.search ?? ''} placeholder="Search by form title…" className="pl-8" />
                </div>
              </div>
              <Select name="status" defaultValue={sp.status ?? ''}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                  <SelectItem value="IN_REVIEW">In review</SelectItem>
                  <SelectItem value="CHANGES_REQUESTED">Changes</SelectItem>
                  <SelectItem value="APPROVED">Approved</SelectItem>
                  <SelectItem value="REJECTED">Rejected</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm"><Filter className="h-3.5 w-3.5" /> Filter</Button>
              {(sp.search || sp.status) && (
                <Link href={`/dashboard/visitor/${slug}`}>
                  <Button variant="ghost" size="sm">Clear</Button>
                </Link>
              )}
            </form>

            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {sp.search || sp.status ? 'No submissions match your filters.' : 'No submissions yet. Visit Forms to get started.'}
              </p>
            ) : (
              <div className="divide-y rounded-lg border">
                {items.map((s) => (
                  <div key={s.id} className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{s.formTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        Updated {s.updatedAt.toISOString().slice(0, 10)}
                      </div>
                    </div>
                    {statusBadge(s.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityFeed items={activity} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
