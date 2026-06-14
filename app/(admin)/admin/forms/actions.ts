'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { createForm, updateForm } from '@/lib/dal/forms'
import { FormSchemaV1 } from '@/lib/forms/schema'

const MetaSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(280).optional().transform((v) => v?.trim() || undefined),
})

export type FormEditorState =
  | undefined
  | { error: string }
  | { fields?: Record<string, string[]> }
  | { success: true; formId: string }

function parseSchemaField(formData: FormData): { ok: true; schema: FormSchemaV1 } | { ok: false; fields: Record<string, string[]> } {
  const raw = formData.get('__schema') ?? formData.get('schema')
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, fields: { schema: ['Schema is required'] } }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, fields: { schema: ['Invalid JSON'] } }
  }
  const result = FormSchemaV1.safeParse(parsed)
  if (!result.success) {
    return { ok: false, fields: result.error.flatten().fieldErrors as Record<string, string[]> }
  }
  return { ok: true, schema: result.data }
}

export async function createFormAction(
  _prev: FormEditorState,
  formData: FormData,
): Promise<FormEditorState> {
  await requireRole('SUPER_ADMIN')

  const meta = MetaSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
  })
  if (!meta.success) return { fields: meta.error.flatten().fieldErrors }

  const schemaResult = parseSchemaField(formData)
  if (!schemaResult.ok) return { fields: schemaResult.fields }

  const formId = await createForm({
    title: meta.data.title,
    description: meta.data.description,
    schema: schemaResult.schema,
  })

  revalidatePath('/admin/forms')
  return { success: true, formId }
}

export async function updateFormAction(
  formId: string,
  _prev: FormEditorState,
  formData: FormData,
): Promise<FormEditorState> {
  await requireRole('SUPER_ADMIN')

  const meta = MetaSchema.safeParse({
    title: formData.get('title'),
    description: formData.get('description'),
  })
  if (!meta.success) return { fields: meta.error.flatten().fieldErrors }

  const schemaResult = parseSchemaField(formData)
  if (!schemaResult.ok) return { fields: schemaResult.fields }

  const isActive = formData.get('isActive') === 'on'
  await updateForm(formId, {
    title: meta.data.title,
    description: meta.data.description,
    schema: schemaResult.schema,
    isActive,
  })

  revalidatePath('/admin/forms')
  revalidatePath(`/admin/forms/${formId}`)
  return { success: true, formId }
}
