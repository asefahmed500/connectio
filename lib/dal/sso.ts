import 'server-only'
import { cache } from 'react'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors'
import type { Prisma, UserRole } from '@prisma/client'

/**
 * Roles that SSO JIT provisioning and SCIM may assign.
 * Privileged roles (SUPER_ADMIN) must never be minted via federated identity.
 */
export const SCIM_ALLOWED_ROLES: readonly UserRole[] = ['TEAM_MEMBER', 'CLIENT'] as const

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

  // Never allow SSO JIT to mint privileged roles.
  if (input.defaultRole && !SCIM_ALLOWED_ROLES.includes(input.defaultRole)) {
    throw new Error(`SSO default role must be one of: ${SCIM_ALLOWED_ROLES.join(', ')}`)
  }

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
    spEntityId: string
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

  // Enforce role allowlist. Build the Prisma update payload field-by-field so
  // the type system catches any mismatch (no `as Record<string, unknown>`).
  if (input.defaultRole !== undefined && !SCIM_ALLOWED_ROLES.includes(input.defaultRole)) {
    throw new Error(`SSO default role must be one of: ${SCIM_ALLOWED_ROLES.join(', ')}`)
  }

  const data: Prisma.SsoProviderUncheckedUpdateInput = {}
  if (input.name !== undefined) data.name = input.name
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.spEntityId !== undefined) data.spEntityId = input.spEntityId
  if (input.idpEntityId !== undefined) data.idpEntityId = input.idpEntityId
  if (input.idpSsoUrl !== undefined) data.idpSsoUrl = input.idpSsoUrl
  if (input.idpCertificate !== undefined) data.idpCertificate = input.idpCertificate
  if (input.oidcIssuer !== undefined) data.oidcIssuer = input.oidcIssuer
  if (input.oidcDiscoveryUrl !== undefined) data.oidcDiscoveryUrl = input.oidcDiscoveryUrl
  if (input.oidcClientId !== undefined) data.oidcClientId = input.oidcClientId
  if (input.oidcClientSecret !== undefined) data.oidcClientSecret = input.oidcClientSecret
  if (input.jitProvisioning !== undefined) data.jitProvisioning = input.jitProvisioning
  if (input.defaultRole !== undefined) data.defaultRole = input.defaultRole
  if (input.attributeMapping !== undefined) {
    data.attributeMapping = input.attributeMapping as Prisma.InputJsonValue
  }

  await prisma.ssoProvider.update({ where: { id }, data })

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

  const row = await prisma.scimApiKey.create({
    data: { name, keyHash, prefix, createdBy: user.id },
  })

  return { id: row.id, key: raw, prefix }
}

export async function revokeScimApiKey(id: string): Promise<void> {
  await requirePermission('sso:manage')
  await prisma.scimApiKey.update({ where: { id }, data: { isActive: false } })
}

export async function verifyScimApiKey(token: string): Promise<boolean> {
  const inputHash = createHash('sha256').update(token, 'utf-8').digest()
  const inputHex = inputHash.toString('hex')
  const key = await prisma.scimApiKey.findFirst({
    where: { keyHash: inputHex, isActive: true },
  })
  if (!key) return false

  if (key.expiresAt && key.expiresAt < new Date()) return false

  // Constant-time comparison of the stored hash against the input hash
  // (defense-in-depth on top of the DB index lookup).
  const storedHash = Buffer.from(key.keyHash, 'hex')
  if (storedHash.length !== inputHash.length) return false
  if (!timingSafeEqual(storedHash, inputHash)) return false

  await prisma.scimApiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  })
  return true
}

function generateApiKey(): string {
  // Cryptographically secure key — 30 bytes (~240 bits) of entropy, base32-encoded.
  const raw = randomBytes(30).toString('base64url')
  return `cc_${raw}`
}
