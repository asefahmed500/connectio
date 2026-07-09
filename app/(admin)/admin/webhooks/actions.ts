'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/dal/session'
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  testWebhook,
} from '@/lib/dal/webhooks'

export async function createWebhookAction(prev: unknown, formData: FormData) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  const raw = Object.fromEntries(formData)
  const eventsRaw = (raw.events as string) || '*'
  const events = eventsRaw === '*' ? ['*'] : eventsRaw.split(',').map((e) => e.trim()).filter(Boolean)

  const id = await createWebhook({
    name: raw.name as string,
    url: raw.url as string,
    secret: (raw.secret as string) || undefined,
    events,
    retryCount: parseInt(raw.retryCount as string, 10) || 3,
    timeoutSec: parseInt(raw.timeoutSec as string, 10) || 10,
    isActive: raw.isActive !== 'false',
    createdBy: user.id,
  })

  revalidatePath('/admin/webhooks')
  redirect('/admin/webhooks')
}

export async function updateWebhookAction(
  id: string,
  prev: unknown,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData)
  const eventsRaw = (raw.events as string) || '*'
  const events = eventsRaw === '*' ? ['*'] : eventsRaw.split(',').map((e) => e.trim()).filter(Boolean)

  await updateWebhook(id, {
    name: raw.name as string,
    url: raw.url as string,
    secret: (raw.secret as string) || undefined,
    events,
    retryCount: parseInt(raw.retryCount as string, 10) || 3,
    timeoutSec: parseInt(raw.timeoutSec as string, 10) || 10,
    isActive: raw.isActive === 'on',
  })

  revalidatePath('/admin/webhooks')
  revalidatePath(`/admin/webhooks/${id}`)
}

export async function deleteWebhookAction(id: string) {
  await deleteWebhook(id)
  revalidatePath('/admin/webhooks')
}

export async function rotateSecretAction(id: string) {
  await rotateWebhookSecret(id)
  revalidatePath(`/admin/webhooks/${id}`)
}

export async function testWebhookAction(id: string) {
  const result = await testWebhook(id)
  revalidatePath(`/admin/webhooks/${id}`)
  return result
}
