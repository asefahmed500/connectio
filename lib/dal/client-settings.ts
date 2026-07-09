import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
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
  return {
    id: row.id as string,
    clientId: row.clientId as string,
    brandColor: row.brandColor as string | null,
    logoUrl: row.logoUrl as string | null,
    faviconUrl: row.faviconUrl as string | null,
    portalTitle: row.portalTitle as string | null,
    customDomain: row.customDomain as string | null,
    customCss: row.customCss as string | null,
    hideBranding: row.hideBranding as boolean,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  }
}

export async function getClientSettings(clientId: string): Promise<ClientSettingsDTO | null> {
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

  const row = await prisma.clientSettings.upsert({
    where: { clientId },
    create: {
      clientId,
      brandColor: data.brandColor ?? null,
      logoUrl: data.logoUrl ?? null,
      faviconUrl: data.faviconUrl ?? null,
      portalTitle: data.portalTitle ?? null,
      customDomain: data.customDomain ?? null,
      customCss: data.customCss ?? null,
      hideBranding: data.hideBranding ?? false,
    },
    update: {
      ...(data.brandColor !== undefined && { brandColor: data.brandColor }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.faviconUrl !== undefined && { faviconUrl: data.faviconUrl }),
      ...(data.portalTitle !== undefined && { portalTitle: data.portalTitle }),
      ...(data.customDomain !== undefined && { customDomain: data.customDomain }),
      ...(data.customCss !== undefined && { customCss: data.customCss }),
      ...(data.hideBranding !== undefined && { hideBranding: data.hideBranding }),
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
