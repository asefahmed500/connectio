'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import {
  updateUser,
  toggleBlockUser,
  adminInitiatePasswordReset,
  deleteUser,
  bulkToggleBlockUser,
  bulkDeleteUser,
} from '@/lib/dal/users'
import { sendEmail } from '@/lib/email'
import type { UserRole } from '@prisma/client'

const UpdateSchema = z.object({
  userId: z.string().cuid(),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  role: z.enum(['SUPER_ADMIN', 'TEAM_MEMBER', 'CLIENT']),
})

export type UserActionState =
  | undefined
  | { error: string }
  | { success: true }

export async function updateUserAction(
  _prev: UserActionState,
  formData: FormData,
): Promise<UserActionState> {
  try {
    await requireRole('SUPER_ADMIN')
    const parsed = UpdateSchema.safeParse({
      userId: formData.get('userId'),
      name: formData.get('name'),
      email: formData.get('email'),
      role: formData.get('role'),
    })
    if (!parsed.success) return { error: 'Invalid input' }

    await updateUser(parsed.data.userId, {
      name: parsed.data.name,
      email: parsed.data.email,
      role: parsed.data.role as UserRole,
    })
    revalidatePath(`/admin/users/${parsed.data.userId}`)
    revalidatePath('/admin/users')
    return { success: true }
  } catch (err) {
    console.error('[users] update failed:', err)
    return { error: 'Could not update user. Check the logs.' }
  }
}

export async function toggleBlockAction(userId: string) {
  try {
    await requireRole('SUPER_ADMIN')
    await toggleBlockUser(userId)
    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
  } catch (err) {
    console.error('[users] toggleBlock failed:', err)
  }
}

/**
 * Triggers the self-serve password-reset flow for the user — emails a 6-digit
 * OTP that the user enters at /reset-password to pick their own password.
 *
 * The plaintext password is NEVER transported: not in email, not in action
 * state, not in client React DevTools. (Previous implementation generated a
 * password and returned + emailed it in plaintext.)
 */
export async function adminResetPasswordAction(userId: string): Promise<UserActionState> {
  await requireRole('SUPER_ADMIN')
  try {
    const { email, name, otp } = await adminInitiatePasswordReset(userId)

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    try {
      await sendEmail({
        to: email,
        subject: 'Reset your ClientConnect password',
        text:
          `Hello ${name},\n\n` +
          `An administrator has reset your password.\n\n` +
          `Your verification code: ${otp}\n\n` +
          `Enter it at ${appUrl}/reset-password to choose a new password.\n` +
          `The code expires in 10 minutes.\n\n` +
          `If you did not expect this, contact your administrator.`,
      })
    } catch (err) {
      console.error('[adminResetPassword] email failed:', err)
    }

    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
    return { success: true }
  } catch (err) {
    console.error('[users] adminResetPassword failed:', err)
    return { error: 'Could not reset password. Check the logs.' }
  }
}

export async function deleteUserAction(userId: string) {
  try {
    await requireRole('SUPER_ADMIN')
    await deleteUser(userId)
    revalidatePath('/admin/users')
    revalidatePath(`/admin/users/${userId}`)
  } catch (err) {
    console.error('[users] deleteUser failed:', err)
  }
}

export async function bulkBlockAction(formData: FormData) {
  try {
    await requireRole('SUPER_ADMIN')
    const userIds = formData.getAll('userIds').map(String)
    await bulkToggleBlockUser(userIds)
    revalidatePath('/admin/users')
  } catch (err) {
    console.error('[users] bulkBlock failed:', err)
  }
}

export async function bulkDeleteAction(formData: FormData) {
  try {
    await requireRole('SUPER_ADMIN')
    const userIds = formData.getAll('userIds').map(String)
    await bulkDeleteUser(userIds)
    revalidatePath('/admin/users')
  } catch (err) {
    console.error('[users] bulkDelete failed:', err)
  }
}
