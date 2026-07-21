'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireRole } from '@/lib/dal/session'
import { createTeamMember, checkEmailTaken } from '@/lib/dal/team'

const Schema = z.object({
  name: z.string().min(1).max(120),
  email: z.email(),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Include at least one symbol'),
  department: z.string().max(80).optional(),
})

export type AddTeamMemberState =
  | undefined
  | { error: string }
  | { fields?: Record<string, string[]> }
  | { success: true }

export async function addTeamMemberAction(
  _prev: AddTeamMemberState,
  formData: FormData,
): Promise<AddTeamMemberState> {
  await requireRole('SUPER_ADMIN')

  const parsed = Schema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    password: formData.get('password'),
    department: formData.get('department') || undefined,
  })
  if (!parsed.success) {
    return { fields: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  try {
    const existing = await checkEmailTaken(parsed.data.email)
    if (existing) return { error: 'An account with this email already exists.' }

    await createTeamMember(parsed.data)
  } catch (err) {
    console.error('[team] addTeamMemberAction failed:', err)
    return { error: 'Could not create team member. Try again.' }
  }

  revalidatePath('/admin/team')
  return { success: true }
}
