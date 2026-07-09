import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listInvites } from '@/lib/dal/invites'
import { CreateInviteForm } from './create-form'
import { RevokeButton } from './revoke-button'
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

export const metadata = { title: 'Invites — ClientConnect' }

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'OPEN'
      ? 'default' as const
      : status === 'CONSUMED'
        ? 'secondary' as const
        : 'outline' as const
  const label = status === 'OPEN' ? 'Open' : status === 'CONSUMED' ? 'Consumed' : status
  return <Badge variant={variant}>{label}</Badge>
}

export default async function InvitesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string; status?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

  const result = await listInvites({ page, pageSize, search: params.search, status: params.status })
  const invites = result.items

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/invites?${p}`
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Invites</h1>
        <p className="text-sm text-muted-foreground">
          Generate invite links for new clients. Each link is valid for 7 days.
        </p>
      </div>

      <CreateInviteForm />

      <Card>
        <CardContent className="p-3">
          <form className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input name="search" defaultValue={params.search ?? ''} placeholder="Search by email or company…" className="pl-8" />
              </div>
            </div>
            <Select name="status" defaultValue={params.status ?? ''}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All status</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="CONSUMED">Consumed</SelectItem>
                <SelectItem value="EXPIRED">Expired</SelectItem>
                <SelectItem value="REVOKED">Revoked</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="sm">Filter</Button>
            {(params.search || params.status) && (
              <Link href="/admin/invites">
                <Button variant="ghost" size="sm">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Invites ({result.total})</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {params.search || params.status ? 'No invites match your filters.' : 'No invites yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{i.email}</TableCell>
                    <TableCell>{i.companyName}</TableCell>
                    <TableCell className="font-mono text-xs">{i.slug}</TableCell>
                    <TableCell><StatusBadge status={i.status} /></TableCell>
                    <TableCell className="text-muted-foreground">
                      {i.createdAt.toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell>{i.status === 'OPEN' && <RevokeButton slug={i.slug} />}</TableCell>
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
    </div>
  )
}
