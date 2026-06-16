import Link from 'next/link'
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
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Forms — ClientConnect' }

export default async function FormsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

  const result = await listAllForms({ page, pageSize })
  const forms = result.items

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

      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <p>No forms yet.</p>
            <Link href="/admin/forms/new" className="text-sm text-primary hover:underline mt-2 inline-block">
              Create your first form →
            </Link>
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
                  <TableCell><StatusPill active={f.isActive} /></TableCell>
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
                    href={`/admin/forms?page=${page - 1}&pageSize=${pageSize}`}
                    className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                  >
                    Previous
                  </Link>
                  <Link
                    href={`/admin/forms?page=${page + 1}&pageSize=${pageSize}`}
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

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="default">Active</Badge>
  ) : (
    <Badge variant="secondary">Inactive</Badge>
  )
}
