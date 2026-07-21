'use server'

import { revalidatePath } from 'next/cache'
import { upsertClientSettings } from '@/lib/dal/client-settings'

export async function saveClientSettingsAction(clientId: string, prev: unknown, formData: FormData) {
  const raw = Object.fromEntries(formData)

  await upsertClientSettings(clientId, {
    brandColor: (raw.brandColor as string) || null,
    logoUrl: (raw.logoUrl as string) || null,
    faviconUrl: (raw.faviconUrl as string) || null,
    portalTitle: (raw.portalTitle as string) || null,
    customDomain: (raw.customDomain as string) || null,
    customCss: (raw.customCss as string) || null,
    hideBranding: raw.hideBranding === 'on',
  })

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath(`/admin/clients/${clientId}/branding`)
}

export async function resetClientSettingsAction(clientId: string) {
  const { deleteClientSettings } = await import('@/lib/dal/client-settings')
  await deleteClientSettings(clientId)
  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath(`/admin/clients/${clientId}/branding`)
}
