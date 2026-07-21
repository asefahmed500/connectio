import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { requireClientAccess } from '@/lib/dal/session'
import { sanitizeCustomCss, sanitizeBrandColor } from '@/lib/sanitize/css'
import { NotFoundError } from '@/lib/errors'

export type ClientSettingsDTO = {
  id: string
  clientId: string
  brandColor: string | null
  logoUrl: string | null
  faviconUrl: string | null
  portalTitle: string | null
  customDomain: string | null
  customCss: string | null
  hideBranding: boolean
  createdAt: Date
  updatedAt: Date
}

type RawSettings = Record<string, unknown>

function toDTO(row: RawSettings): ClientSettingsDTO {
  // Sanitize at READ time too — defense-in-depth against any pre-existing
  // unsanitized rows that pre-date the sanitizer.
  return {
    id: row.id as string,
    clientId: row.clientId as string,
    brandColor: sanitizeBrandColor(row.brandColor as string | null),
    logoUrl: row.logoUrl as string | null,
    faviconUrl: row.faviconUrl as string | null,
    portalTitle: row.portalTitle as string | null,
    customDomain: row.customDomain as string | null,
    customCss: sanitizeCustomCss(row.customCss as string | null),
    hideBranding: row.hideBranding as boolean,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  }
}

export async function getClientSettings(clientId: string): Promise<ClientSettingsDTO | null> {
  await requireClientAccess(clientId)
  const row = await prisma.clientSettings.findUnique({
    where: { clientId },
  })
  return row ? toDTO(row as unknown as RawSettings) : null
}

export async function upsertClientSettings(
  clientId: string,
  data: {
    brandColor?: string | null
    logoUrl?: string | null
    faviconUrl?: string | null
    portalTitle?: string | null
    customDomain?: string | null
    customCss?: string | null
    hideBranding?: boolean
  },
): Promise<ClientSettingsDTO> {
  const user = await requirePermission('client:update')

  // Sanitize all admin-controlled presentation fields before persisting.
  const safeData = {
    ...data,
    brandColor: data.brandColor !== undefined && data.brandColor !== null
      ? sanitizeBrandColor(data.brandColor)
      : data.brandColor,
    customCss: data.customCss !== undefined && data.customCss !== null
      ? sanitizeCustomCss(data.customCss)
      : data.customCss,
  }

  const row = await prisma.clientSettings.upsert({
    where: { clientId },
    create: {
      clientId,
      brandColor: safeData.brandColor ?? null,
      logoUrl: safeData.logoUrl ?? null,
      faviconUrl: safeData.faviconUrl ?? null,
      portalTitle: safeData.portalTitle ?? null,
      customDomain: safeData.customDomain ?? null,
      customCss: safeData.customCss ?? null,
      hideBranding: safeData.hideBranding ?? false,
    },
    update: {
      ...(safeData.brandColor !== undefined && { brandColor: safeData.brandColor }),
      ...(safeData.logoUrl !== undefined && { logoUrl: safeData.logoUrl }),
      ...(safeData.faviconUrl !== undefined && { faviconUrl: safeData.faviconUrl }),
      ...(safeData.portalTitle !== undefined && { portalTitle: safeData.portalTitle }),
      ...(safeData.customDomain !== undefined && { customDomain: safeData.customDomain }),
      ...(safeData.customCss !== undefined && { customCss: safeData.customCss }),
      ...(safeData.hideBranding !== undefined && { hideBranding: safeData.hideBranding }),
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'CLIENT_SETTINGS_UPDATED',
    userId: user.id,
    resource: 'Client',
    resourceId: clientId,
    changes: { after: data },
  })

  return toDTO(row as unknown as RawSettings)
}

export async function deleteClientSettings(clientId: string): Promise<void> {
  await requirePermission('client:delete')
  await prisma.clientSettings.deleteMany({ where: { clientId } })
}
