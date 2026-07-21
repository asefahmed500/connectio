'use server'

import { revalidatePath } from 'next/cache'
import { revokeSession, revokeAllSessionsForUser } from '@/lib/dal/sessions-admin'

export async function revokeSessionAction(sessionId: string): Promise<void> {
  await revokeSession(sessionId)
  revalidatePath('/admin/sessions')
}

export async function revokeAllUserSessionsAction(userId: string): Promise<void> {
  await revokeAllSessionsForUser(userId)
  revalidatePath('/admin/sessions')
}
