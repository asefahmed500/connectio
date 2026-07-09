import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import type { Prisma } from '@prisma/client'

export type AuditLogDTO = {
  id: string
  action: string
  resource: string
  resourceId: string
  changes: unknown
  ip: string | null
  userAgent: string | null
  userName: string | null
  userEmail: string | null
  createdAt: Date
}

export type AuditLogFilters = {
  page?: number
  pageSize?: number
  search?: string
  action?: string
  resource?: string
  userId?: string
  dateFrom?: string
  dateTo?: string
}

export type AuditLogResult = {
  items: AuditLogDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResult> {
  await requirePermission('audit:read')

  const page = Math.max(1, filters.page ?? 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20))
  const skip = (page - 1) * pageSize

  const where: Prisma.AuditLogWhereInput = {}

  if (filters.search) {
    where.OR = [
      { action: { contains: filters.search, mode: 'insensitive' } },
      { resource: { contains: filters.search, mode: 'insensitive' } },
      { resourceId: { contains: filters.search, mode: 'insensitive' } },
      { ip: { contains: filters.search, mode: 'insensitive' } },
      { user: { name: { contains: filters.search, mode: 'insensitive' } } },
      { user: { email: { contains: filters.search, mode: 'insensitive' } } },
    ]
  }
  if (filters.action) where.action = filters.action
  if (filters.resource) where.resource = filters.resource
  if (filters.userId) where.userId = filters.userId
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {}
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo + 'T23:59:59.999Z')
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, email: true } } },
      take: pageSize,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ])

  const totalPages = Math.ceil(total / pageSize)

  const items: AuditLogDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    resource: r.resource,
    resourceId: r.resourceId,
    changes: r.changes,
    ip: r.ip,
    userAgent: r.userAgent,
    userName: r.user?.name ?? null,
    userEmail: r.user?.email ?? null,
    createdAt: r.createdAt,
  }))

  return { items, total, page, pageSize, totalPages }
}

export async function getDistinctActions(): Promise<string[]> {
  await requirePermission('audit:read')
  const rows = await prisma.auditLog.findMany({
    distinct: ['action'],
    select: { action: true },
    orderBy: { action: 'asc' },
  })
  return rows.map((r) => r.action)
}

export async function getDistinctResources(): Promise<string[]> {
  await requirePermission('audit:read')
  const rows = await prisma.auditLog.findMany({
    distinct: ['resource'],
    select: { resource: true },
    orderBy: { resource: 'asc' },
  })
  return rows.map((r) => r.resource)
}
