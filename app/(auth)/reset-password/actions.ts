'use server'

import { z } from 'zod'
import { createPasswordResetOtp, verifyResetOtp, resetPassword } from '@/lib/dal/password-reset'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'
import { headers } from 'next/headers'
import { cookies } from 'next/headers'

const EmailSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
})

const OtpSchema = z.object({
  email: z.string().min(1),
  otp: z.string().length(6, 'Verification code must be 6 digits').regex(/^\d{6}$/, 'Enter a 6-digit code'),
})

const ResetSchema = z.object({
  password: z.string().min(1, 'Password is required'),
  confirm: z.string().min(1),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
})

export type ForgotPasswordState =
  | { step: 'email'; error?: string }
  | { step: 'otp'; email: string; error?: string }
  | { step: 'reset'; minLength: number; error?: string }
  | { step: 'done' }
  | undefined

export async function sendOtpAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'

  const raw = Object.fromEntries(formData)
  const parsed = EmailSchema.safeParse(raw)
  if (!parsed.success) {
    return { step: 'email', error: 'Please enter a valid email address.' }
  }

  const email = parsed.data.email

  const rl = await rateLimitAll(
    rateLimit(`forgot-pw:ip:${ip}`, { limit: 5, window: 60 }),
    // Per-email limit prevents email-bombing a single victim from rotating IPs.
    rateLimit(`forgot-pw:email:${email.toLowerCase()}`, { limit: 3, window: 3600 }),
  )
  if (!rl.ok) {
    return { step: 'email', error: 'Too many attempts. Please wait a minute.' }
  }

  try {
    const { rawOtp, userExists } = await createPasswordResetOtp(email)

    // Always proceed to OTP step to prevent email enumeration.
    if (!userExists) return { step: 'otp', email }

    const { sendPasswordResetEmail } = await import('@/lib/email')
    await sendPasswordResetEmail({ to: email, otp: rawOtp })
  } catch (err) {
    console.error('[send-otp] failed:', err)
  }

  return { step: 'otp', email }
}

export async function verifyOtpAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const raw = Object.fromEntries(formData)
  const parsed = OtpSchema.safeParse(raw)
  if (!parsed.success) {
    return { step: 'otp', email: raw.email as string, error: 'Enter a valid 6-digit verification code.' }
  }

  const email = parsed.data.email

  try {
    const result = await verifyResetOtp(email, parsed.data.otp)

    if (!result.ok) {
      return { step: 'otp', email, error: result.error }
    }

    // Set the reset_token cookie via the cookies API
    const cookieStore = await cookies()
    cookieStore.set('reset_token', result.resetTokenCookie!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60,
      path: '/',
    })

    const { getNumberSetting } = await import('@/lib/dal/settings')
    const minLength = await getNumberSetting('passwordMinLength')

    return { step: 'reset', minLength }
  } catch (err) {
    console.error('[verify-otp] failed:', err)
    return { step: 'otp', email, error: 'Something went wrong. Try again.' }
  }
}

export async function completeResetAction(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'

  const rl = await rateLimitAll(
    rateLimit(`reset-pw:ip:${ip}`, { limit: 5, window: 60 }),
  )
  if (!rl.ok) {
    return { step: 'reset', minLength: 12, error: 'Too many attempts. Please wait a minute.' }
  }

  const { getNumberSetting } = await import('@/lib/dal/settings')
  const minLength = await getNumberSetting('passwordMinLength')

  const ResetSchemaWithMin = z.object({
    password: z.string().min(minLength, `Password must be at least ${minLength} characters`),
    confirm: z.string().min(1),
  }).refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

  const raw = Object.fromEntries(formData)
  const parsed = ResetSchemaWithMin.safeParse(raw)
  if (!parsed.success) {
    return { step: 'reset', minLength, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const result = await resetPassword({ newPassword: parsed.data.password })
  if (!result.ok) {
    return { step: 'reset', minLength, error: result.error ?? 'Something went wrong.' }
  }

  return { step: 'done' }
}
