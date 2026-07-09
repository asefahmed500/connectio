import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getFormDTO } from '@/lib/dal/forms'
import { listSubmissionsForForm } from '@/lib/dal/submissions'
import { FormEditor } from '../form-editor'
import { FieldPreview } from './field-preview'

export const metadata = { title: 'Edit form — ClientConnect' }

export default async function EditFormPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const form = await getFormDTO(id).catch(() => null)
  if (!form) notFound()

  const submissions = await listSubmissionsForForm(id)

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <Link href="/admin/forms" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to forms
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Edit form</h1>
      </div>

      <FormEditor
        mode="edit"
        formId={form.id}
        initialTitle={form.title}
        initialDescription={form.description}
        initialSchema={form.schema}
        initialIsActive={form.isActive}
      />

      <div>
        <h2 className="text-lg font-semibold mb-2">Field preview</h2>
        <div className="border rounded-lg p-4 flex flex-col gap-3 bg-muted/20">
          {form.schema.fields.map((f) => (
            <FieldPreview key={f.name} field={f} />
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Recent submissions ({submissions.length})</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {submissions.map((s) => (
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
