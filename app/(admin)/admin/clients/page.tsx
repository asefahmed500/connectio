import Link from 'next/link'
import { listAllClients } from '@/lib/dal/clients'

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="text-sm text-muted-foreground">All clients across the system.</p>
      </div>
      {clients.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">No clients yet.</p>
          <Link href="/admin/invites" className="text-sm text-primary hover:underline mt-2 inline-block">
            Create an invite to add one →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Company</th>
                <th className="pr-3">Contact</th>
                <th className="pr-3">Slug</th>
                <th className="pr-3">Subs</th>
                <th className="pr-3">Files</th>
                <th className="pr-3">Last activity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{c.companyName}</td>
                  <td className="pr-3">{c.contactName}</td>
                  <td className="pr-3 font-mono text-xs">{c.uniqueSlug}</td>
                  <td className="pr-3">{c.submissionsCount}</td>
                  <td className="pr-3">{c.filesCount}</td>
                  <td className="pr-3 text-muted-foreground">
                    {c.lastActivityAt ? c.lastActivityAt.toISOString().slice(0, 10) : '—'}
                  </td>
                  <td>
                    <Link href={`/admin/clients/${c.id}`} className="text-primary hover:underline">
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
                  href={`/admin/clients?page=${page - 1}&pageSize=${pageSize}`}
                  className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium ${page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}
                >
                  Previous
                </Link>
                <Link
                  href={`/admin/clients?page=${page + 1}&pageSize=${pageSize}`}
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
  )
}
