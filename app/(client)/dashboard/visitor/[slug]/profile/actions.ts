'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/dal/session'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { requestErasure } from '@/lib/dal/gdpr'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'
import { headers } from 'next/headers'
import { z } from 'zod'

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export async function changePasswordAction(
  slug: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  // Rate-limit per-user so a compromised-session attacker can't brute-force
  // the current password via this endpoint.
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? 'unknown'
  const rl = await rateLimitAll(
    rateLimit(`change-pw:sub:${user.id}`, { limit: 5, window: 300 }),
    rateLimit(`change-pw:ip:${ip}`, { limit: 10, window: 300 }),
  )
  if (!rl.ok) return { error: 'Too many attempts. Please wait a few minutes.' }

  const data = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const parsed = changePasswordSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message! }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, tokenVersion: true },
  })
  if (!record) return { error: 'User not found' }

  const valid = await verifyPassword(record.passwordHash, data.currentPassword)
  if (!valid) return { error: 'Current password is incorrect' }

  // Update password, bump tokenVersion (invalidates all other sessions), and
  // revoke all OTHER sessions — but keep this one alive so the user stays
  // logged in. Done in one tx so a partial failure can't desync.
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(data.newPassword),
        tokenVersion: record.tokenVersion + 1,
      },
    })
    // The caller's current session has its own refresh path; bumping
    // tokenVersion will force re-auth on the next access-token renewal.
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  })

  revalidatePath(`/dashboard/visitor/${slug}/profile`)
  return { success: true }
}

export async function requestErasureAction(slug: string): Promise<void> {
  await requestErasure()
  revalidatePath(`/dashboard/visitor/${slug}/profile`)
  revalidatePath(`/dashboard/visitor/${slug}`)
}
