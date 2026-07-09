'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { updateUser, toggleBlockUser, adminResetPassword, deleteUser, bulkToggleBlockUser, bulkDeleteUser } from '@/lib/dal/users'
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
  | { success: true; password?: string }

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
    return { error: err instanceof Error ? err.message : 'Update failed' }
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

export async function adminResetPasswordAction(userId: string): Promise<UserActionState> {
  await requireRole('SUPER_ADMIN')
  try {
    const result = await adminResetPassword(userId)

    const { prisma } = await import('@/lib/db')
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, name: true } })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    try {
      await sendEmail({
        to: user.email,
        subject: 'Your ClientConnect password has been reset',
        text: `Hello ${user.name},\n\nYour password has been reset by an administrator.\n\nYour new password: ${result.password}\n\nLogin at: ${appUrl}/login\n\nPlease change your password after logging in.`,
      })
    } catch (err) {
      console.error('[adminResetPassword] email failed:', err)
    }

    revalidatePath(`/admin/users/${userId}`)
    revalidatePath('/admin/users')
    return { success: true, password: result.password }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Reset failed' }
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
