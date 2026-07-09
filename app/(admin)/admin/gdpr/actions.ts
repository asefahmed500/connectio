'use server'

import { revalidatePath } from 'next/cache'
import { approveErasure, denyErasure } from '@/lib/dal/gdpr'

export async function approveErasureAction(requestId: string): Promise<void> {
  await approveErasure(requestId)
  revalidatePath('/admin/gdpr')
}

export async function denyErasureAction(requestId: string): Promise<void> {
  await denyErasure(requestId)
  revalidatePath('/admin/gdpr')
}
