import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { listAuditLogs, getDistinctActions, getDistinctResources } from '@/lib/dal/audit-logs'

export const metadata = { title: 'Audit log — ClientConnect' }

function actionColor(action: string) {
  if (action.includes('delete') || action.includes('DELETE')) return 'destructive' as const
  if (action.includes('create') || action.includes('CREATE')) return 'default' as const
  return 'secondary' as const
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string; action?: string; resource?: string; dateFrom?: string; dateTo?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20
  const actionFilter = params.action && params.action !== 'all' ? params.action : undefined
  const resourceFilter = params.resource && params.resource !== 'all' ? params.resource : undefined

  const [result, actions, resources] = await Promise.all([
    listAuditLogs({
      page,
      pageSize,
      search: params.search,
      action: actionFilter,
      resource: resourceFilter,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
    }),
    getDistinctActions(),
    getDistinctResources(),
  ])

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/audit-log?${p}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Chronological record of all system actions.
        </p>
      </div>

      <Card>
        <CardContent className="p-3">
          <form className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input name="search" defaultValue={params.search ?? ''} placeholder="Search action, resource, IP…" className="pl-8" />
              </div>
            </div>
            <Select name="action" defaultValue={params.action ?? ''}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select name="resource" defaultValue={params.resource ?? ''}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All resources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All resources</SelectItem>
                {resources.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input name="dateFrom" type="date" defaultValue={params.dateFrom ?? ''} className="w-full sm:w-[150px]" aria-label="From date" />
            <Input name="dateTo" type="date" defaultValue={params.dateTo ?? ''} className="w-full sm:w-[150px]" aria-label="To date" />
            <Button type="submit" variant="outline" size="sm">Filter</Button>
            {(params.search || params.action || params.resource || params.dateFrom || params.dateTo) && (
              <Link href="/admin/audit-log">
                <Button variant="ghost" size="sm">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No audit log entries found.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Resource ID</TableHead>
                <TableHead>IP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {e.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate" title={`${e.userName ?? 'Unknown'} (${e.userEmail ?? ''})`}>
                    {e.userName ?? <span className="text-muted-foreground italic">System</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={actionColor(e.action)} className="text-[10px] font-mono">{e.action}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{e.resource}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono max-w-[140px] truncate" title={e.resourceId}>
                    {e.resourceId.slice(0, 12)}…
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{e.ip ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {result.totalPages > 1 && (
            <>
              <Separator />
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, result.total)} of {result.total}
                </span>
                <div className="flex gap-2">
                  <Link
                    href={link({ ...params, page: String(page - 1), pageSize: String(pageSize) })}
                    className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                  >
                    Previous
                  </Link>
                  <Link
                    href={link({ ...params, page: String(page + 1), pageSize: String(pageSize) })}
                    className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page >= result.totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                  >
                    Next
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
