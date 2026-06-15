import Link from 'next/link'
import { listAllTeamMembers } from '@/lib/dal/team'
import { AddTeamMemberForm } from './add-form'

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team members</h1>
        <p className="text-sm text-muted-foreground">
          Add team members and assign them to specific clients.
        </p>
      </div>

      <AddTeamMemberForm />

      <div>
        <h2 className="text-lg font-semibold mb-3">All team members ({result.total})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Name</th>
                  <th className="pr-3">Email</th>
                  <th className="pr-3">Department</th>
                  <th className="pr-3">Clients</th>
                  <th className="pr-3">Added</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2 pr-3 font-medium">{m.name}</td>
                    <td className="pr-3">{m.email}</td>
                    <td className="pr-3">{m.department ?? '—'}</td>
                    <td className="pr-3 tabular-nums">{m.assignedClientCount}</td>
                    <td className="pr-3 text-muted-foreground">
                      {m.createdAt.toISOString().slice(0, 10)}
                    </td>
                    <td>
                      <Link
                        href={`/admin/team/${m.id}`}
                        className="text-primary hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {result.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, result.total)} of {result.total} results
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/team?page=${page - 1}&pageSize=${pageSize}`}
                    className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium ${page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}
                  >
                    Previous
                  </Link>
                  <Link
                    href={`/admin/team?page=${page + 1}&pageSize=${pageSize}`}
                    className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium ${page >= result.totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}
                  >
                    Next
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
