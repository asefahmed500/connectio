'use server'

import 'server-only'

import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { saveDraft, submit } from '@/lib/dal/submissions'
import { parseFormSchema } from '@/lib/forms/schema'
import { validateSubmission } from '@/lib/forms/validate'

export async function saveDraftAction(input: {
  clientId: string
  formId: string
  formData: Record<string, unknown>
}): Promise<{ success: boolean; error?: string }> {
  try {
    await saveDraft(input)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}

import type { SubmitActionState } from '@/components/forms/submission-form'

export async function submitAction(
  _prev: SubmitActionState,
  formData: FormData,
): Promise<SubmitActionState> {
  const submissionId = formData.get('submissionId') as string
  const clientId = formData.get('clientId') as string
  const formId = formData.get('formId') as string
  const raw = formData.get('formData') as string

  if (!submissionId || !clientId || !formId || !raw) {
    return { error: 'Missing required fields' }
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw)
  } catch {
    return { error: 'Invalid form data' }
  }

  const form = await prisma.form.findFirstOrThrow({
    where: { id: formId, isActive: true, deletedAt: null },
  })

  const schema = parseFormSchema(form.formSchema as unknown)
  const parsed = validateSubmission(schema, data)
  if (!parsed.success) {
    const fields: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '_form')
      if (!fields[key]) fields[key] = []
      fields[key].push(issue.message)
    }
    return { fields }
  }

  try {
    await submit({ clientId, formId, formData: data })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Submit failed' }
  }

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { uniqueSlug: true },
  })
  redirect(`/dashboard/visitor/${client.uniqueSlug}/submissions/${submissionId}`)
}
