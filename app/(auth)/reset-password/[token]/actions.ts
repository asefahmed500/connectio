'use server'

import { z } from 'zod'
import { resetPassword } from '@/lib/dal/password-reset'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'
import { headers } from 'next/headers'

const ResetSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirm: z.string().min(1),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

export type ResetPasswordState =
  | { error: string }
  | { success: true }
  | undefined

export async function resetPasswordAction(
  token: string,
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'

  const rl = await rateLimitAll(
    rateLimit(`reset-pw:ip:${ip}`, { limit: 5, window: 60 }),
  )
  if (!rl.ok) {
    return { error: 'Too many attempts. Please wait a minute.' }
  }

  const raw = Object.fromEntries(formData)
  const parsed = ResetSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const result = await resetPassword({
    token,
    newPassword: parsed.data.password,
  })

  if (!result.ok) {
    return { error: result.error ?? 'Something went wrong.' }
  }

  return { success: true }
}
