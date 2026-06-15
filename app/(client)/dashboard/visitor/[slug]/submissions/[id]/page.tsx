import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireClientAccessBySlug } from '@/lib/dal/session'
import { getSubmissionDTO } from '@/lib/dal/submissions'
import { parseFormSchema } from '@/lib/forms/schema'
import { SubmissionForm } from './submission-form'

export const metadata = { title: 'Submission — ClientConnect' }

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>
}) {
  const { slug, id } = await params
  const clientId = await requireClientAccessBySlug(slug)

  const sub = await getSubmissionDTO(id)
  if (sub.clientId !== clientId) notFound()

  const form = await prisma.form.findUniqueOrThrow({ where: { id: sub.formId, deletedAt: null } })
  const schema = parseFormSchema(form.formSchema as unknown)

  // Determine if the client can edit based on state machine.
  const canEdit = sub.status === 'DRAFT' || sub.status === 'CHANGES_REQUESTED'

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{form.title}</h1>
        {form.description && (
          <p className="text-sm text-muted-foreground mt-1">{form.description}</p>
        )}
        <p className="text-xs uppercase tracking-wide text-muted-foreground mt-2">
          Status: {sub.status.replace('_', ' ')}
        </p>
      </div>

      <SubmissionForm
        submissionId={sub.id}
        clientId={sub.clientId}
        formId={sub.formId}
        schema={schema}
        initialData={sub.formData}
        canEdit={canEdit}
        status={sub.status}
      />
    </div>
  )
}
