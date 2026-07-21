'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { createClientAccount } from '@/lib/dal/clients'
import { sendEmail } from '@/lib/email'

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

  try {
    await createClientAccount({ email, name, companyName, contactName })
  } catch (err) {
    console.error('[clients] createClientAccount failed:', err)
    return { error: 'Could not create client account. Check the logs.' }
  }

  // Trigger the OTP-based password reset so the user picks their own password
  // instead of receiving one in plaintext via email.
  try {
    const { createPasswordResetOtp } = await import('@/lib/dal/password-reset')
    const { rawOtp, userExists } = await createPasswordResetOtp(email)
    if (userExists && rawOtp) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      await sendEmail({
        to: email,
        subject: 'Welcome to ClientConnect — set your password',
        text:
          `Hello ${contactName},\n\n` +
          `Your account has been created at ${companyName}.\n\n` +
          `Set your password: ${appUrl}/reset-password\n` +
          `Your verification code: ${rawOtp}\n\n` +
          `The code expires in 10 minutes.`,
      })
    }
  } catch (err) {
    console.error('[clients] welcome email failed:', err)
  }

  revalidatePath('/admin/clients')
  return { success: true, email }
}
