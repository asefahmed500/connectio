import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormDTO } from '@/lib/dal/forms'
import { listSubmissionsForForm } from '@/lib/dal/submissions'
import { listUsersForPicker } from '@/lib/dal/users'
import { FormEditor } from '../form-editor'
import { FieldPreview } from './field-preview'
import { SendFormDialog } from '@/components/forms/send-form-dialog'
import { Pagination } from '@/components/shared/pagination'

export const metadata = { title: 'Edit form — ClientConnect' }

export default async function EditFormPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const { id } = await params
  const form = await getFormDTO(id).catch(() => null)
  if (!form) notFound()

  const sp = await searchParams
  const page = sp.page ? parseInt(sp.page, 10) : 1
  const pageSize = sp.pageSize ? parseInt(sp.pageSize, 10) : 20

  const submissions = await listSubmissionsForForm(id, { page, pageSize })
  const users = await listUsersForPicker()

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/forms/${id}?${p}`
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin/forms" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to forms
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">Edit form</h1>
      </div>

      <FormEditor
        mode="edit"
        formId={form.id}
        initialTitle={form.title}
        initialDescription={form.description}
        initialSchema={form.schema}
        initialIsActive={form.isActive}
      />

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Field preview</h2>
        <SendFormDialog formId={form.id} users={users} />
      </div>
      <div className="border rounded-lg p-4 flex flex-col gap-3 bg-muted/20">
        {form.schema.fields.map((f) => (
          <FieldPreview key={f.name} field={f} />
        ))}
      </div>

      <div>
        <div className="flex items-start justify-between mb-2">
          <h2 className="text-lg font-semibold">Recent submissions ({submissions.total})</h2>
          {submissions.totalPages > 1 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={submissions.total}
              totalPages={submissions.totalPages}
              buildHref={link}
              currentParams={{ page: String(page), pageSize: String(pageSize) }}
            />
          )}
        </div>
        {submissions.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {submissions.items.map((s) => (
              <li key={s.id} className="border rounded p-3 flex justify-between">
                <span>{s.client.companyName}</span>
                <span className="text-muted-foreground">{s.status.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
