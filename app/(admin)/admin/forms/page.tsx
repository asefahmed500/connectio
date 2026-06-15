import Link from 'next/link'
import { listAllForms } from '@/lib/dal/forms'

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
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
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
        <div className="border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">No forms yet.</p>
          <Link href="/admin/forms/new" className="text-sm text-primary hover:underline mt-2 inline-block">
            Create your first form →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Title</th>
                <th className="pr-3">Fields</th>
                <th className="pr-3">Submissions</th>
                <th className="pr-3">Status</th>
                <th className="pr-3">Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {forms.map((f) => (
                <tr key={f.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{f.title}</td>
                  <td className="pr-3">{f.fieldCount}</td>
                  <td className="pr-3">{f.submissionCount}</td>
                  <td className="pr-3">
                    <StatusPill active={f.isActive} />
                  </td>
                  <td className="pr-3 text-muted-foreground">{f.updatedAt.toISOString().slice(0, 10)}</td>
                  <td>
                    <Link href={`/admin/forms/${f.id}`} className="text-primary hover:underline">
                      Edit
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
                  href={`/admin/forms?page=${page - 1}&pageSize=${pageSize}`}
                  className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium ${page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted'}`}
                >
                  Previous
                </Link>
                <Link
                  href={`/admin/forms?page=${page + 1}&pageSize=${pageSize}`}
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

function StatusPill({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      Active
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
      Inactive
    </span>
  )
}
