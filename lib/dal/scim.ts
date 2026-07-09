import 'server-only'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import type { Prisma, UserRole } from '@prisma/client'

// ─────────────────────────────────────────────────────────────────────
// SCIM 2.0 User schema helpers
// ─────────────────────────────────────────────────────────────────────

export type ScimUser = {
  schemas: string[]
  id: string
  userName: string
  name: {
    givenName: string
    familyName: string
  }
  emails: { value: string; primary: boolean }[]
  active: boolean
  roles: { value: string }[]
  meta: {
    resourceType: string
    created: string
    lastModified: string
  }
}

export type ScimListResponse = {
  schemas: string[]
  totalResults: number
  startIndex: number
  itemsPerPage: number
  Resources: ScimUser[]
}

export type ScimErrorResponse = {
  schemas: string[]
  status: string
  scimType?: string
  detail: string
}

// ─────────────────────────────────────────────────────────────────────
// SCIM endpoints
// ─────────────────────────────────────────────────────────────────────

export async function scimListUsers(
  startIndex = 1,
  count = 100,
  filter?: string,
): Promise<ScimListResponse> {
  const take = Math.min(count, 200)
  const skip = Math.max(0, startIndex - 1)

  const where: Prisma.UserWhereInput = { deletedAt: null }
  if (filter) {
    // Support simple filter: userName eq "email@example.com"
    const match = filter.match(/userName\s+eq\s+"([^"]+)"/i)
    if (match) where.email = match[1]
  }

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take,
      skip,
    }),
    prisma.user.count({ where }),
  ])

  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: total,
    startIndex,
    itemsPerPage: take,
    Resources: rows.map(toScimUser),
  }
}

export async function scimGetUser(id: string): Promise<ScimUser | null> {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
  })
  return user ? toScimUser(user) : null
}

export async function scimCreateUser(input: {
  userName: string
  givenName?: string
  familyName?: string
  active?: boolean
  password?: string
  role?: UserRole
}): Promise<ScimUser> {
  const email = input.userName.toLowerCase()
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : await hashPassword(generateTempPassword())

  const user = await prisma.user.create({
    data: {
      email,
      name: [input.givenName, input.familyName].filter(Boolean).join(' ') || email,
      passwordHash,
      role: input.role ?? 'TEAM_MEMBER',
      isActive: input.active ?? true,
    },
  })

  return toScimUser(user)
}

export async function scimUpdateUser(
  id: string,
  input: {
    userName?: string
    givenName?: string
    familyName?: string
    active?: boolean
    role?: UserRole
  },
): Promise<ScimUser | null> {
  const data: Record<string, unknown> = {}
  if (input.userName) data.email = input.userName.toLowerCase()
  if (input.givenName || input.familyName) {
    const existing = await prisma.user.findUnique({ where: { id } })
    if (existing) {
      data.name = [input.givenName, input.familyName].filter(Boolean).join(' ') || existing.name
    }
  }
  if (input.active !== undefined) data.isActive = input.active
  if (input.role) data.role = input.role

  if (Object.keys(data).length === 0) return scimGetUser(id)

  try {
    const user = await prisma.user.update({ where: { id }, data })
    return toScimUser(user)
  } catch {
    return null
  }
}

export async function scimPatchUser(
  id: string,
  operations: { op: string; path?: string; value: unknown }[],
): Promise<ScimUser | null> {
  const user = await prisma.user.findFirst({ where: { id, deletedAt: null } })
  if (!user) return null

  const data: Record<string, unknown> = {}

  for (const op of operations) {
    if (op.op === 'replace') {
      if (op.path === 'active') {
        data.isActive = op.value as boolean
      } else if (op.path === 'name.givenName' || op.path === 'name.familyName') {
        const parts = user.name.split(' ')
        if (op.path?.endsWith('givenName')) {
          data.name = `${op.value as string} ${parts.slice(1).join(' ')}`
        } else {
          data.name = `${parts[0]} ${op.value as string}`
        }
      } else if (!op.path && typeof op.value === 'object' && op.value !== null) {
        const v = op.value as Record<string, unknown>
        if (v.active !== undefined) data.isActive = v.active
        if (v.userName) data.email = (v.userName as string).toLowerCase()
      }
    } else if (op.op === 'replace' && !op.path) {
      const v = op.value as Record<string, unknown>
      if (v.active !== undefined) data.isActive = v.active as boolean
      if (v.userName) data.email = (v.userName as string).toLowerCase()
    }
  }

  if (Object.keys(data).length === 0) return toScimUser(user)

  try {
    const updated = await prisma.user.update({ where: { id }, data })
    return toScimUser(updated)
  } catch {
    // Return the current state if the PATCH didn't actually change anything
    return toScimUser(user)
  }
}

export async function scimDeleteUser(id: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        tokenVersion: { increment: 1 },
      },
    })
    await prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return true
  } catch {
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────
// SCIM 2.0 Group (minimal — returns flattened assignment-based groups)
// ─────────────────────────────────────────────────────────────────────

export type ScimGroup = {
  schemas: string[]
  id: string
  displayName: string
  members: { value: string; display: string }[]
  meta: { resourceType: string }
}

export async function scimListGroups(): Promise<{
  schemas: string[]
  totalResults: number
  Resources: ScimGroup[]
}> {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    include: {
      assignments: {
        include: { teamMember: { include: { user: { select: { id: true, name: true } } } } },
      },
    },
    orderBy: { companyName: 'asc' },
  })

  const groups: ScimGroup[] = clients.map((c) => ({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    id: c.id,
    displayName: c.companyName,
    members: c.assignments.map((a) => ({
      value: a.teamMember.user.id,
      display: a.teamMember.user.name,
    })),
    meta: { resourceType: 'Group' },
  }))

  return {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
    totalResults: groups.length,
    Resources: groups,
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function toScimUser(u: {
  id: string
  email: string
  name: string
  role: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): ScimUser {
  const nameParts = u.name.split(' ')
  return {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    id: u.id,
    userName: u.email,
    name: {
      givenName: nameParts[0] ?? '',
      familyName: nameParts.slice(1).join(' ') || (nameParts[0] ?? ''),
    },
    emails: [{ value: u.email, primary: true }],
    active: u.isActive,
    roles: [{ value: u.role }],
    meta: {
      resourceType: 'User',
      created: u.createdAt.toISOString(),
      lastModified: u.updatedAt.toISOString(),
    },
  }
}

function generateTempPassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$'
  let result = ''
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
