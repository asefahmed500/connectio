import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireClientAccess } from '@/lib/dal/session'
import { requirePermission } from '@/lib/auth/permissions'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import { proposeSlug } from '@/lib/dal/invites'
import type { Prisma } from '@prisma/client'

export type ClientDTO = {
  id: string
  companyName: string
  contactName: string
  uniqueSlug: string
  projectBrief: string | null
  budget: string | null
  timeline: string | null
  submissionsCount: number
  commentsCount: number
  filesCount: number
  lastActivityAt: Date | null
  createdAt: Date
}

async function toDTO(c: {
  id: string
  companyName: string
  contactName: string
  uniqueSlug: string
  projectBrief: string | null
  budget: string | null
  timeline: string | null
  _count: { submissions: number; comments: number; files: number }
  submissions: { updatedAt: Date }[]
  createdAt: Date
}): Promise<ClientDTO> {
  return {
    id: c.id,
    companyName: c.companyName,
    contactName: c.contactName,
    uniqueSlug: c.uniqueSlug,
    projectBrief: c.projectBrief,
    budget: c.budget,
    timeline: c.timeline,
    submissionsCount: c._count.submissions,
    commentsCount: c._count.comments,
    filesCount: c._count.files,
    lastActivityAt: c.submissions[0]?.updatedAt ?? null,
    createdAt: c.createdAt,
  }
}

export type ClientListParams = PaginationParams & {
  search?: string
}

export async function listAllClients(params?: ClientListParams): Promise<PaginatedResult<ClientDTO>> {
  await requirePermission('client:read')
  const { take, skip } = paginationParams(params)

  const where: Prisma.ClientWhereInput = { deletedAt: null }
  if (params?.search) {
    where.OR = [
      { companyName: { contains: params.search, mode: 'insensitive' } },
      { contactName: { contains: params.search, mode: 'insensitive' } },
      { uniqueSlug: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            submissions: { where: { deletedAt: null } },
            comments: { where: { deletedAt: null } },
            files: { where: { deletedAt: null } },
          },
        },
        submissions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
      },
      take,
      skip,
    }),
    prisma.client.count({ where }),
  ])

  const items = await Promise.all(rows.map(toDTO))
  return toPaginated(items, total, params)
}

export const getClientDTO = cache(async (clientId: string): Promise<ClientDTO | null> => {
  await requireClientAccess(clientId)
  const c = await prisma.client.findUnique({
    where: { id: clientId, deletedAt: null },
    include: {
      _count: {
        select: {
          submissions: { where: { deletedAt: null } },
          comments: { where: { deletedAt: null } },
          files: { where: { deletedAt: null } },
        },
      },
      submissions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
    },
  })
  if (!c) return null
  return toDTO(c)
})

function randomPick(arr: string): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generatePassword(): string {
  const special = '!@#$%^&*'
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lower = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const all = upper + lower + digits + special
  const required = [
    randomPick(upper),
    randomPick(lower),
    randomPick(digits),
    randomPick(special),
  ]
  const rest = Array.from({ length: 10 }, () => randomPick(all))
  return [...required, ...rest].sort(() => Math.random() - 0.5).join('')
}

export async function updateClient(
  clientId: string,
  input: {
    companyName?: string
    contactName?: string
    projectBrief?: string | null
    budget?: string | null
    timeline?: string | null
  },
): Promise<void> {
  await requirePermission('client:update')
  await prisma.client.update({
    where: { id: clientId, deletedAt: null },
    data: input,
  })
}

export async function createClientAccount(input: {
  email: string
  name: string
  companyName: string
  contactName: string
}): Promise<{ userId: string; clientId: string; slug: string; password: string }> {
  const user = await requirePermission('client:create')
  const password = generatePassword()
  const { hashPassword } = await import('@/lib/auth/password')
  const passwordHash = await hashPassword(password)

  const slug = await proposeSlug({ contactName: input.contactName, companyName: input.companyName })

  const result = await prisma.$transaction(async (tx) => {
    const existingEmail = await tx.user.findUnique({ where: { email: input.email.toLowerCase() } })
    if (existingEmail) throw new Error('A user with this email already exists')

    const user = await tx.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash,
        role: 'CLIENT',
        client: {
          create: {
            companyName: input.companyName,
            contactName: input.contactName,
            uniqueSlug: slug,
          },
        },
      },
      include: { client: true },
    })
    return user
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'CLIENT_ACCOUNT_CREATED',
    userId: user.id,
    resource: 'User',
    resourceId: result.id,
  })

  return {
    userId: result.id,
    clientId: result.client!.id,
    slug,
    password,
  }
}
