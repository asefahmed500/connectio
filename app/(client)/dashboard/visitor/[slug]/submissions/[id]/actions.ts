'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { saveDraft, submit } from '@/lib/dal/submissions'
import { prisma } from '@/lib/db'
import { parseFormSchema } from '@/lib/forms/schema'
import { validateSubmission } from '@/lib/forms/validate'

const SaveDraftSchema = z.object({
  submissionId: z.string().cuid(),
  clientId: z.string().cuid(),
  formId: z.string().cuid(),
  formData: z.record(z.string(), z.unknown()),
})

export type DraftResult = { success: true } | { success: false; error: string }

export async function saveDraftAction(input: {
  submissionId: string
  clientId: string
  formId: string
  formData: Record<string, unknown>
}): Promise<DraftResult> {
  const parsed = SaveDraftSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: 'Invalid input' }

  try {
    await saveDraft(parsed.data)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Save failed' }
  }
}

export type SubmissionFormState =
  | undefined
  | { error?: string }
  | { fields?: Record<string, string[]> }

export async function submitAction(
  _prev: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  const submissionId = String(formData.get('submissionId'))
  const clientId = String(formData.get('clientId'))
  const formId = String(formData.get('formId'))

  // Parse the JSON-encoded formData the client sent.
  let parsedData: unknown
  try {
    parsedData = JSON.parse(String(formData.get('formData') ?? '{}'))
  } catch {
    return { error: 'Form data was malformed.' }
  }

  // Load the form to get the schema, then validate server-side.
  const form = await prisma.form.findFirstOrThrow({
    where: { id: formId, isActive: true },
  })
  const schema = parseFormSchema(form.formSchema as unknown)
  const validated = validateSubmission(schema, parsedData)
  if (!validated.success) {
    return { fields: validated.error.flatten().fieldErrors as Record<string, string[]> }
  }

  try {
    await submit({
      clientId,
      formId,
      formData: validated.data as Record<string, unknown>,
    })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Submit failed' }
  }

  redirect(`../submissions/${submissionId}`)
}
