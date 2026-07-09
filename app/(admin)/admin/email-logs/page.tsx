import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { listEmailLogs, getDistinctEmailCategories } from '@/lib/dal/email-logs'

export const metadata = { title: 'Email logs — ClientConnect' }

function statusVariant(status: string) {
  if (status === 'sent') return 'default' as const
  if (status === 'failed') return 'destructive' as const
  return 'secondary' as const
}

export default async function EmailLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string; category?: string; status?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

  const [result, categories] = await Promise.all([
    listEmailLogs({
      page,
      pageSize,
      search: params.search,
      category: params.category,
      status: params.status,
    }),
    getDistinctEmailCategories(),
  ])

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/email-logs?${p}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Email logs</h1>
        <p className="text-sm text-muted-foreground">
          Transactional email delivery history.
        </p>
      </div>

      <Card>
        <CardContent className="p-3">
          <form className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input name="search" defaultValue={params.search ?? ''} placeholder="Search recipient or subject…" className="pl-8" />
              </div>
            </div>
            <Select name="category" defaultValue={params.category ?? ''}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select name="status" defaultValue={params.status ?? ''}>
              <SelectTrigger className="w-full sm:w-[140px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All statuses</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
            <button type="submit" className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium hover:bg-muted gap-1">
              <Search className="w-3 h-3" />
              Filter
            </button>
            {(params.search || params.category || params.status) && (
              <Link href="/admin/email-logs">
                <span className="inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-medium hover:bg-muted">Clear</span>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No email logs found.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {e.createdAt.toISOString().replace('T', ' ').slice(0, 19)}
                  </TableCell>
                  <TableCell className="text-sm max-w-[180px] truncate" title={e.to}>{e.to}</TableCell>
                  <TableCell className="text-sm max-w-[240px] truncate" title={e.subject}>{e.subject}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.category ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{e.provider ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(e.status)} className="text-[10px]">{e.status}</Badge>
                    {e.error && (
                      <span className="block text-[10px] text-destructive mt-0.5 max-w-[160px] truncate" title={e.error}>
                        {e.error}
                      </span>
                    )}
                  </TableCell>
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
