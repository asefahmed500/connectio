import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { listAllTeamMembers } from '@/lib/dal/team'
import { AddTeamMemberForm } from './add-form'
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
import { Pagination } from '@/components/shared/pagination'
import { Search } from 'lucide-react'
import { ExportCsvButton } from '@/components/admin/export-csv-button'

export const metadata = { title: 'Team — ClientConnect' }

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

  const result = await listAllTeamMembers({ page, pageSize, search: params.search })
  const members = result.items

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/team?${p}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Team members</h1>
        <p className="text-sm text-muted-foreground">
          Add team members and assign them to specific clients.
        </p>
      </div>

      <AddTeamMemberForm />

      <Card>
        <CardContent className="p-3">
          <div className="flex gap-3 flex-wrap items-center justify-between">
            <form className="flex gap-3 flex-wrap items-center flex-1">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input name="search" defaultValue={params.search ?? ''} placeholder="Search by name or email…" className="pl-8" aria-label="Search team members" />
                </div>
              </div>
              <Button type="submit" variant="outline" size="sm">Filter</Button>
              {params.search && (
                <Link href="/admin/team">
                  <Button variant="ghost" size="sm">Clear</Button>
                </Link>
              )}
            </form>
            <ExportCsvButton
              fetchUrl="/api/admin/export?type=team"
              filename="team-members.csv"
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'department', label: 'Department', format: 'string' },
                { key: 'assignedClientCount', label: 'Clients', format: 'string' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">All team members ({result.total})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {params.search ? 'No team members match your search.' : 'No team members yet.'}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Clients</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{m.department ?? '—'}</TableCell>
                    <TableCell className="tabular-nums">{m.assignedClientCount}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {m.createdAt.toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/team/${m.id}`}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>

            {result.totalPages > 1 && (
              <>
                <Separator />
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={result.total}
                  totalPages={result.totalPages}
                  buildHref={link}
                  currentParams={params}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
