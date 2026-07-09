'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  upsertEmailTemplate,
  deleteEmailTemplate,
} from '@/lib/dal/email-templates'

export async function saveEmailTemplateAction(prev: unknown, formData: FormData) {
  const raw = Object.fromEntries(formData)
  const id = raw.id as string

  const key = (raw.key as string).trim()
  if (!key) return { error: 'Key is required' }

  await upsertEmailTemplate({
    key: id ? key : key,
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
