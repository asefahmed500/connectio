import { notFound, redirect } from 'next/navigation'
import { requireClientAccessBySlug } from '@/lib/dal/session'
import { getOrCreateDraft } from '@/lib/dal/submissions'
import { getFormForSubmission } from '@/lib/dal/forms'
import { parseFormSchema } from '@/lib/forms/schema'

// ?formId=<id> → ensure a draft exists for this client+form, then redirect
// to the submission edit page. Keeps the URL clean and idempotent.
export default async function NewSubmissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ formId?: string }>
}) {
  const { slug } = await params
  const { formId } = await searchParams
  if (!formId) notFound()

  const clientId = await requireClientAccessBySlug(slug)

  const form = await getFormForSubmission(formId)
  if (!form || !form.isActive) notFound()
  parseFormSchema(form.formSchema as unknown) // sanity: schema must be valid

  const draft = await getOrCreateDraft({ clientId, formId })
  redirect(`/dashboard/visitor/${slug}/submissions/${draft.id}`)
}
