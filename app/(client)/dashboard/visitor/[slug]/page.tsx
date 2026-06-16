import { requireClientAccessBySlug } from '@/lib/dal/session'
import { listSubmissionsForClient } from '@/lib/dal/submissions'
import { countComments } from '@/lib/dal/comments'
import { listFilesForClient } from '@/lib/dal/files'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, MessageSquare, Upload } from 'lucide-react'

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
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)

  const [submissions, comments, files] = await Promise.all([
    listSubmissionsForClient(clientId),
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

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <FileText className="size-3.5" />
              Submissions
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{items.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Comments
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{comments}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription className="flex items-center gap-1.5">
              <Upload className="size-3.5" />
              Files
            </CardDescription>
            <CardTitle className="text-2xl tabular-nums">{files.total}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Your submissions</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submissions yet. Visit <em>Forms</em> to get started.
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
      </div>
    </div>
  )
}
