'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { createClientAccount } from '@/lib/dal/clients'
import { sendEmail } from '@/lib/email'
import { renderWelcomeEmail } from '@/lib/email-templates'

const CreateClientSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  companyName: z.string().min(1).max(120),
  contactName: z.string().min(1).max(120),
})

export type CreateClientState =
  | undefined
  | { error: string }
  | { success: true; email: string }

export async function createClientAction(
  _prev: CreateClientState,
  formData: FormData,
): Promise<CreateClientState> {
  try {
    await requireRole('SUPER_ADMIN')
  } catch {
    return { error: 'Unauthorized' }
  }

  const parsed = CreateClientSchema.safeParse({
    email: formData.get('email'),
    name: formData.get('name'),
    companyName: formData.get('companyName'),
    contactName: formData.get('contactName'),
  })
  if (!parsed.success) {
    return { error: 'Please fill all fields correctly.' }
  }

  const { email, name, companyName, contactName } = parsed.data

  let account
  try {
    account = await createClientAccount({ email, name, companyName, contactName })
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create account' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const loginUrl = `${appUrl}/login`

  const tpl = renderWelcomeEmail({
    contactName,
    companyName,
    email,
    password: account.password,
    loginUrl,
  })

  try {
    await sendEmail({
      to: email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    })
  } catch (err) {
    console.error('[createClient] Email send failed:', err)
  }

  revalidatePath('/admin/clients')
  return { success: true, email }
}
