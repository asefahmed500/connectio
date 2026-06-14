'use server'

import { redirect } from 'next/navigation'
import { deleteSession } from '@/lib/auth/session'
import { getCurrentUser } from '@/lib/dal/session'
import { writeAudit } from '@/lib/audit'

export async function logoutAction(): Promise<void> {
  const user = await getCurrentUser()
  await deleteSession()
  if (user) {
    await writeAudit({
      action: 'USER_LOGOUT',
      userId: user.id,
      resource: 'User',
      resourceId: user.id,
    })
  }
  redirect('/login')
}
