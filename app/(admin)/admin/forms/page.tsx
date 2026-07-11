import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listAllForms } from '@/lib/dal/forms'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { ExportCsvButton } from '@/components/admin/export-csv-button'

export const metadata = { title: 'Forms — ClientConnect' }

export default async function FormsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string; isActive?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20
  const isActive = params.isActive === 'true' ? true : params.isActive === 'false' ? false : undefined

  const result = await listAllForms({ page, pageSize, search: params.search, isActive })
  const forms = result.items

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/forms?${p}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-heading tracking-wide">Forms</h1>
          <p className="text-sm text-muted-foreground">
            Define the requirement forms your clients will fill out.
          </p>
        </div>
        <Link
          href="/admin/forms/new"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          New form
        </Link>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex gap-3 flex-wrap items-center justify-between">
            <form className="flex gap-3 flex-wrap items-center flex-1">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="search" defaultValue={params.search ?? ''} placeholder="Search by title…" className="pl-8" />
                </div>
              </div>
              <Select name="isActive" defaultValue={params.isActive ?? ''}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" variant="outline" size="sm">Filter</Button>
              {(params.search || params.isActive) && (
                <Link href="/admin/forms">
                  <Button variant="ghost" size="sm">Clear</Button>
                </Link>
              )}
            </form>
            <ExportCsvButton
              fetchUrl="/api/admin/export?type=forms"
              filename="forms.csv"
              columns={[
                { key: 'title', label: 'Title' },
                { key: 'fieldCount', label: 'Fields', format: 'string' },
                { key: 'submissionCount', label: 'Submissions', format: 'string' },
                { key: 'isActive', label: 'Active', format: 'boolean' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {params.search || params.isActive ? 'No forms match your filters.' : 'No forms yet.'}
            {!params.search && !params.isActive && (
              <Link href="/admin/forms/new" className="text-sm text-primary hover:underline mt-2 inline-block">
                Create your first form →
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Fields</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.title}</TableCell>
                  <TableCell>{f.fieldCount}</TableCell>
                  <TableCell>{f.submissionCount}</TableCell>
                  <TableCell>
                    {f.isActive ? (
                      <Badge variant="default">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{f.updatedAt.toISOString().slice(0, 10)}</TableCell>
                  <TableCell>
                    <Link href={`/admin/forms/${f.id}`} className="text-primary hover:underline">
                      Edit
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {result.totalPages > 1 && (
            <>
              <Separator />
              <div className="flex items-center justify-between pt-4">
                <div className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, result.total)} of {result.total} results
                </div>
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
