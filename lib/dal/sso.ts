import 'server-only'
import { cache } from 'react'
import { createHash } from 'crypto'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors'
import type { Prisma, UserRole } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────
// SSO Provider CRUD
// ─────────────────────────────────────────────────────────────────────

export type SsoProviderDTO = {
  id: string
  name: string
  providerType: 'saml' | 'oidc'
  isActive: boolean
  spEntityId: string
  spAcsUrl: string | null
  jitProvisioning: boolean
  defaultRole: UserRole
  idpEntityId: string | null
  idpSsoUrl: string | null
  idpCertificate: string | null
  oidcIssuer: string | null
  oidcDiscoveryUrl: string | null
  oidcClientId: string | null
  attributeMapping: Record<string, unknown> | null
  userCount: number
  createdAt: Date
}

function toDTO(p: Record<string, unknown>): SsoProviderDTO {
  return {
    id: p.id as string,
    name: p.name as string,
    providerType: p.providerType as 'saml' | 'oidc',
    isActive: p.isActive as boolean,
    spEntityId: p.spEntityId as string,
    spAcsUrl: p.spAcsUrl as string | null,
    jitProvisioning: p.jitProvisioning as boolean,
    defaultRole: p.defaultRole as UserRole,
    idpEntityId: p.idpEntityId as string | null,
    idpSsoUrl: p.idpSsoUrl as string | null,
    idpCertificate: p.idpCertificate as string | null,
    oidcIssuer: p.oidcIssuer as string | null,
    oidcDiscoveryUrl: p.oidcDiscoveryUrl as string | null,
    oidcClientId: p.oidcClientId as string | null,
    attributeMapping: (p.attributeMapping as Record<string, unknown> | undefined) ?? null,
    userCount: (p._count as { users: number })?.users ?? 0,
    createdAt: p.createdAt as Date,
  }
}

export async function listSsoProviders(): Promise<SsoProviderDTO[]> {
  await requirePermission('sso:manage')
  const rows = await prisma.ssoProvider.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toDTO)
}

export async function getSsoProvider(id: string): Promise<SsoProviderDTO | null> {
  await requirePermission('sso:manage')
  const row = await prisma.ssoProvider.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  })
  return row ? toDTO(row) : null
}

export async function createSsoProvider(input: {
  name: string
  providerType: 'saml' | 'oidc'
  spEntityId?: string
  isActive?: boolean
  idpEntityId?: string
  idpSsoUrl?: string
  idpCertificate?: string
  oidcIssuer?: string
  oidcDiscoveryUrl?: string
  oidcClientId?: string
  oidcClientSecret?: string
  jitProvisioning?: boolean
  defaultRole?: UserRole
  attributeMapping?: Record<string, unknown>
}): Promise<string> {
  const user = await requirePermission('sso:manage')

  const provider = await prisma.ssoProvider.create({
    data: {
      name: input.name,
      providerType: input.providerType,
      spEntityId: input.spEntityId ?? 'urn:connectio:sso',
      isActive: input.isActive ?? true,
      idpEntityId: input.idpEntityId,
      idpSsoUrl: input.idpSsoUrl,
      idpCertificate: input.idpCertificate,
      oidcIssuer: input.oidcIssuer,
      oidcDiscoveryUrl: input.oidcDiscoveryUrl,
      oidcClientId: input.oidcClientId,
      oidcClientSecret: input.oidcClientSecret,
      jitProvisioning: input.jitProvisioning ?? true,
      defaultRole: input.defaultRole ?? 'TEAM_MEMBER',
      attributeMapping: (input.attributeMapping ?? undefined) as Prisma.InputJsonValue,
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SSO_PROVIDER_CREATED',
    userId: user.id,
    resource: 'SsoProvider',
    resourceId: provider.id,
  })

  return provider.id
}

export async function updateSsoProvider(
  id: string,
  input: Partial<{
    name: string
    isActive: boolean
    spEntityId: string | null
    idpEntityId: string | null
    idpSsoUrl: string | null
    idpCertificate: string | null
    oidcIssuer: string | null
    oidcDiscoveryUrl: string | null
    oidcClientId: string | null
    oidcClientSecret: string | null
    jitProvisioning: boolean
    defaultRole: UserRole
    attributeMapping: Record<string, unknown>
  }>,
): Promise<void> {
  const user = await requirePermission('sso:manage')

  await prisma.ssoProvider.update({ where: { id }, data: input as Record<string, unknown> })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SSO_PROVIDER_UPDATED',
    userId: user.id,
    resource: 'SsoProvider',
    resourceId: id,
  })
}

export async function deleteSsoProvider(id: string): Promise<void> {
  const user = await requirePermission('sso:manage')

  const provider = await prisma.ssoProvider.findUnique({ where: { id }, include: { _count: { select: { users: true } } } })
  if (!provider) throw new NotFoundError('SsoProvider')
  if (provider._count.users > 0) {
    throw new Error('Cannot delete SSO provider with active users. Unlink users first.')
  }

  await prisma.ssoProvider.delete({ where: { id } })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SSO_PROVIDER_DELETED',
    userId: user.id,
    resource: 'SsoProvider',
    resourceId: id,
  })
}

// ─────────────────────────────────────────────────────────────────────
// SSO Login
// ─────────────────────────────────────────────────────────────────────

export async function getActiveProviders(): Promise<
  { id: string; name: string; providerType: string }[]
> {
  const rows = await prisma.ssoProvider.findMany({
    where: { isActive: true },
    select: { id: true, name: true, providerType: true },
    orderBy: { name: 'asc' },
  })
  return rows
}

export async function generateSpMetadata(baseUrl: string, providerId: string): Promise<string> {
  const provider = await prisma.ssoProvider.findUnique({ where: { id: providerId } })
  if (!provider) throw new NotFoundError('SsoProvider')

  const entityId = provider.spEntityId
  const acsUrl = `${baseUrl}/api/auth/sso/${providerId}/acs`

  return `<?xml version="1.0"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
    entityID="${escapeXml(entityId)}">
  <md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
      protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        Location="${escapeXml(acsUrl)}" index="1" isDefault="true"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// ─────────────────────────────────────────────────────────────────────
// SCIM API key management
// ─────────────────────────────────────────────────────────────────────

export type ScimApiKeyDTO = {
  id: string
  name: string
  prefix: string
  lastUsedAt: Date | null
  expiresAt: Date | null
  isActive: boolean
  createdAt: Date
}

export async function listScimApiKeys(): Promise<ScimApiKeyDTO[]> {
  await requirePermission('sso:manage')
  const rows = await prisma.scimApiKey.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((k) => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    lastUsedAt: k.lastUsedAt,
    expiresAt: k.expiresAt,
    isActive: k.isActive,
    createdAt: k.createdAt,
  }))
}

export async function createScimApiKey(name: string): Promise<{ id: string; key: string; prefix: string }> {
  const user = await requirePermission('sso:manage')

  const raw = generateApiKey()
  const prefix = raw.slice(0, 8)
  const keyHash = createHash('sha256').update(raw, 'utf-8').digest('hex')

  await prisma.scimApiKey.create({
    data: { name, keyHash, prefix, createdBy: user.id },
  })

  return { id: prefix, key: raw, prefix }
}

export async function revokeScimApiKey(id: string): Promise<void> {
  await requirePermission('sso:manage')
  await prisma.scimApiKey.update({ where: { id }, data: { isActive: false } })
}

export async function verifyScimApiKey(token: string): Promise<boolean> {
  const keyHash = createHash('sha256').update(token, 'utf-8').digest('hex')
  const key = await prisma.scimApiKey.findFirst({
    where: { keyHash, isActive: true },
  })
  if (!key) return false

  if (key.expiresAt && key.expiresAt < new Date()) return false

  await prisma.scimApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  })
  return true
}

function generateApiKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let result = 'cc_'
  for (let i = 0; i < 40; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
