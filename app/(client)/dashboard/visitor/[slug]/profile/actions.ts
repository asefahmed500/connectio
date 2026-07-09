'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/dal/session'
import { prisma } from '@/lib/db'
import { hashPassword, verifyPassword } from '@/lib/auth/password'
import { requestErasure } from '@/lib/dal/gdpr'
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
  _slug: string,
  prev: unknown,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: 'Not authenticated' }

  const data = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  }

  const parsed = changePasswordSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })
  if (!record) return { error: 'User not found' }

  const valid = await verifyPassword(record.passwordHash, data.currentPassword)
  if (!valid) return { error: 'Current password is incorrect' }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(data.newPassword) },
  })

  return { success: true }
}

export async function requestErasureAction(_slug: string): Promise<void> {
  await requestErasure()
  revalidatePath('/dashboard/visitor/[slug]/profile')
}
