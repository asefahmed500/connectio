import 'server-only'
import { randomBytes, createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors'

export type ApiKeyDTO = {
  id: string
  name: string
  prefix: string
  permissions: string[]
  scopes: string[]
  lastUsedAt: Date | null
  expiresAt: Date | null
  isActive: boolean
  createdAt: Date
}

function toDTO(k: Record<string, unknown>): ApiKeyDTO {
  return {
    id: k.id as string,
    name: k.name as string,
    prefix: k.prefix as string,
    permissions: (k.permissions as string[] | undefined) ?? [],
    scopes: (k.scopes as string[] | undefined) ?? [],
    lastUsedAt: k.lastUsedAt as Date | null,
    expiresAt: k.expiresAt as Date | null,
    isActive: k.isActive as boolean,
    createdAt: k.createdAt as Date,
  }
}

export async function listApiKeys(): Promise<ApiKeyDTO[]> {
  await requirePermission('settings:manage')
  const rows = await prisma.apiKey.findMany({ orderBy: { createdAt: 'desc' } })
  return rows.map((r) => toDTO(r as unknown as Record<string, unknown>))
}

export async function createApiKey(
  name: string,
  permissions: string[],
  scopes: string[],
  userId: string,
): Promise<{ id: string; key: string; prefix: string }> {
  await requirePermission('settings:manage')
  const raw = randomBytes(32).toString('hex')
  const keyHash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 8)

  const row = await prisma.apiKey.create({
    data: {
      name,
      keyHash,
      prefix,
      permissions: permissions.length > 0 ? permissions : ['read:*'],
      scopes,
      createdBy: userId,
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'API_KEY_CREATED',
    userId,
    resource: 'ApiKey',
    resourceId: row.id,
  })

  return { id: row.id, key: raw, prefix }
}

export async function revokeApiKey(id: string, userId: string): Promise<void> {
  await requirePermission('settings:manage')
  const existing = await prisma.apiKey.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('ApiKey')
  await prisma.apiKey.update({ where: { id }, data: { isActive: false } })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'API_KEY_REVOKED',
    userId,
    resource: 'ApiKey',
    resourceId: id,
  })
}
