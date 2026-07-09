'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentUser } from '@/lib/dal/session'
import { createApiKey, revokeApiKey } from '@/lib/dal/api-keys'

export async function createKeyAction(formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  await createApiKey(
    (formData.get('name') as string) || 'Untitled',
    ((formData.get('permissions') as string) || 'read:*').split(',').map((s) => s.trim()).filter(Boolean),
    [],
    user.id,
  )
  revalidatePath('/admin/api-keys')
}

export async function revokeKeyAction(keyId: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')
  await revokeApiKey(keyId, user.id)
  revalidatePath('/admin/api-keys')
}
