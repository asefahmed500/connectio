import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'

export type EmailLogDTO = {
  id: string
  to: string
  subject: string
  category: string | null
  provider: string | null
  status: string
  error: string | null
  deliveredAt: Date | null
  createdAt: Date
}

function toDTO(e: Record<string, unknown>): EmailLogDTO {
  return {
    id: e.id as string,
    to: e.to as string,
    subject: e.subject as string,
    category: e.category as string | null,
    provider: e.provider as string | null,
    status: e.status as string,
    error: e.error as string | null,
    deliveredAt: e.deliveredAt as Date | null,
    createdAt: e.createdAt as Date,
  }
}

export async function listEmailLogs(params?: PaginationParams & {
  search?: string
  category?: string
  status?: string
}): Promise<PaginatedResult<EmailLogDTO>> {
  await requirePermission('audit:read')
  const { take, skip } = paginationParams(params)

  const where: Record<string, unknown> = {}
  if (params?.search) {
    where.OR = [
      { to: { contains: params.search, mode: 'insensitive' } },
      { subject: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params?.category) where.category = params.category
  if (params?.status) where.status = params.status

  const [rows, total] = await Promise.all([
    prisma.emailLog.findMany({
      where: where as import('@prisma/client').Prisma.EmailLogWhereInput,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.emailLog.count({ where: where as import('@prisma/client').Prisma.EmailLogWhereInput }),
  ])

  return toPaginated(rows.map((r) => toDTO(r as unknown as Record<string, unknown>)), total, params)
}

export async function getDistinctEmailCategories(): Promise<string[]> {
  await requirePermission('audit:read')
  const rows = await prisma.emailLog.findMany({
    where: { category: { not: null } },
    select: { category: true },
    distinct: ['category'],
  })
  return rows.map((r) => r.category as string).filter(Boolean)
}
