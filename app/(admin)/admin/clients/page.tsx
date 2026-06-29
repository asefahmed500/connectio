import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { listAllClients } from '@/lib/dal/clients'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Clients — ClientConnect' }

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

  const result = await listAllClients({ page, pageSize })
  const clients = result.items

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Clients</h1>
        <p className="text-sm text-muted-foreground">All clients across the system.</p>
      </div>
      <div className="flex gap-3 mb-2">
        <Link href="/admin/clients/create">
          <Button variant="default">Create client</Button>
        </Link>
        <Link href="/admin/invites">
          <Button variant="outline">Send invite link</Button>
        </Link>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            <p>No clients yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Subs</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Last activity</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.companyName}</TableCell>
                  <TableCell>{c.contactName}</TableCell>
                  <TableCell className="font-mono text-xs">{c.uniqueSlug}</TableCell>
                  <TableCell>{c.submissionsCount}</TableCell>
                  <TableCell>{c.filesCount}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.lastActivityAt ? c.lastActivityAt.toISOString().slice(0, 10) : '—'}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/clients/${c.id}`} className="text-primary hover:underline">
                      View
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
                    href={`/admin/clients?page=${page - 1}&pageSize=${pageSize}`}
                    className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                  >
                    Previous
                  </Link>
                  <Link
                    href={`/admin/clients?page=${page + 1}&pageSize=${pageSize}`}
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
