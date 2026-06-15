'use server'

import { z } from 'zod'
import { createPasswordResetToken } from '@/lib/dal/password-reset'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'
import { headers } from 'next/headers'

const ForgotSchema = z.object({
  email: z.string().min(1).email(),
})

export type ForgotPasswordState =
  | { error: string }
  | { success: true }
  | undefined

export async function forgotPasswordAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'

  const rl = await rateLimitAll(
    rateLimit(`forgot-pw:ip:${ip}`, { limit: 5, window: 60 }),
  )
  if (!rl.ok) {
    return { error: 'Too many attempts. Please wait a minute.' }
  }

  const raw = Object.fromEntries(formData)
  const parsed = ForgotSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: 'Please enter a valid email address.' }
  }

  try {
    const token = await createPasswordResetToken(parsed.data.email)

    // Always return success to prevent email enumeration.
    if (!token) return { success: true }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password/${token}`

    const { sendPasswordResetEmail } = await import('@/lib/email')
    await sendPasswordResetEmail({ to: parsed.data.email, resetUrl })
  } catch (err) {
    console.error('[forgot-password] failed:', err)
  }

  return { success: true }
}
