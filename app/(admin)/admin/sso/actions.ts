'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createSsoProvider, updateSsoProvider, deleteSsoProvider, createScimApiKey, revokeScimApiKey } from '@/lib/dal/sso'

export async function createSsoAction(prev: unknown, formData: FormData) {
  const raw = Object.fromEntries(formData)
  const providerType = raw.providerType as string

  const id = await createSsoProvider({
    name: raw.name as string,
    providerType: providerType as 'saml' | 'oidc',
    spEntityId: (raw.spEntityId as string) || undefined,
    isActive: raw.isActive === 'on',
    idpEntityId: (raw.idpEntityId as string) || undefined,
    idpSsoUrl: (raw.idpSsoUrl as string) || undefined,
    idpCertificate: (raw.idpCertificate as string) || undefined,
    oidcIssuer: (raw.oidcIssuer as string) || undefined,
    oidcDiscoveryUrl: (raw.oidcDiscoveryUrl as string) || undefined,
    oidcClientId: (raw.oidcClientId as string) || undefined,
    oidcClientSecret: (raw.oidcClientSecret as string) || undefined,
    jitProvisioning: raw.jitProvisioning === 'on',
    defaultRole: raw.defaultRole as import('@prisma/client').UserRole | undefined,
  })

  revalidatePath('/admin/sso')
  redirect(`/admin/sso/${id}`)
}

export async function updateSsoAction(
  providerId: string,
  prev: unknown,
  formData: FormData,
) {
  const raw = Object.fromEntries(formData)

  await updateSsoProvider(providerId, {
    name: raw.name as string,
    isActive: raw.isActive === 'on',
    spEntityId: (raw.spEntityId as string) || 'urn:connectio:sso',
    idpEntityId: (raw.idpEntityId as string) || null,
    idpSsoUrl: (raw.idpSsoUrl as string) || null,
    idpCertificate: (raw.idpCertificate as string) || null,
    oidcIssuer: (raw.oidcIssuer as string) || null,
    oidcDiscoveryUrl: (raw.oidcDiscoveryUrl as string) || null,
    oidcClientId: (raw.oidcClientId as string) || null,
    oidcClientSecret: (raw.oidcClientSecret as string) || null,
    jitProvisioning: raw.jitProvisioning === 'on',
    defaultRole: raw.defaultRole as import('@prisma/client').UserRole,
  })

  revalidatePath('/admin/sso')
  revalidatePath(`/admin/sso/${providerId}`)
}

export async function deleteSsoAction(providerId: string) {
  await deleteSsoProvider(providerId)
  revalidatePath('/admin/sso')
}

export async function createScimKeyAction(prev: unknown, formData: FormData) {
  const name = formData.get('name') as string
  const result = await createScimApiKey(name)
  revalidatePath('/admin/sso')
  return { key: result.key, name }
}

export async function revokeScimKeyAction(keyId: string) {
  await revokeScimApiKey(keyId)
  revalidatePath('/admin/sso')
}
