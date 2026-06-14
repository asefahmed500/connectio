import Link from 'next/link'
import { listAllForms } from '@/lib/dal/forms'

export const metadata = { title: 'Forms — ClientConnect' }

export default async function FormsListPage() {
  const forms = await listAllForms()

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
