import Link from 'next/link'
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
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Team — ClientConnect' }

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

  const result = await listAllTeamMembers({ page, pageSize })
  const members = result.items

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Team members</h1>
        <p className="text-sm text-muted-foreground">
          Add team members and assign them to specific clients.
        </p>
      </div>

      <AddTeamMemberForm />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">All team members ({result.total})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
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

            {result.totalPages > 1 && (
              <>
                <Separator />
                <div className="flex items-center justify-between pt-4">
                  <div className="text-xs text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, result.total)} of {result.total} results
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/team?page=${page - 1}&pageSize=${pageSize}`}
                      className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                    >
                      Previous
                    </Link>
                    <Link
                      href={`/admin/team?page=${page + 1}&pageSize=${pageSize}`}
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
