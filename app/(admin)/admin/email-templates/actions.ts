'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  upsertEmailTemplate,
  deleteEmailTemplate,
} from '@/lib/dal/email-templates'

/**
 * Saves (creates or updates) an email template.
 *
 * Signature is `(id | null, _prev, formData)` so it can be invoked both as a
 * bound form action (server component) and via an inline arrow in a client
 * component (see template-form.tsx).
 */
export async function saveEmailTemplateAction(
  id: string | null,
  _prev: unknown,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData)

  const key = (raw.key as string).trim()
  if (!key) return { error: 'Key is required' }

  await upsertEmailTemplate({
    id: id ?? undefined,
    key,
    name: (raw.name as string) || key,
    category: (raw.category as string) || null,
    subject: raw.subject as string,
    htmlBody: (raw.htmlBody as string) || null,
    textBody: (raw.textBody as string) || null,
    variables: (raw.variables as string) || null,
    isActive: raw.isActive === 'on',
  })

  revalidatePath('/admin/email-templates')
  redirect('/admin/email-templates')
}

export async function deleteEmailTemplateAction(id: string) {
  await deleteEmailTemplate(id)
  revalidatePath('/admin/email-templates')
}
