import 'server-only'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors'

export type WebhookDTO = {
  id: string
  name: string
  url: string
  secret: string | null
  isActive: boolean
  events: string[]
  retryCount: number
  timeoutSec: number
  lastDeliveredAt: Date | null
  lastStatus: number | null
  lastError: string | null
  createdBy: string
  deliveryCount: number
  createdAt: Date
  updatedAt: Date
}

function toDTO(row: Record<string, unknown>): WebhookDTO {
  return {
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    secret: row.secret as string | null,
    isActive: row.isActive as boolean,
    events: (row.events as string[] | undefined) ?? [],
    retryCount: row.retryCount as number,
    timeoutSec: row.timeoutSec as number,
    lastDeliveredAt: row.lastDeliveredAt as Date | null,
    lastStatus: row.lastStatus as number | null,
    lastError: row.lastError as string | null,
    createdBy: row.createdBy as string,
    deliveryCount: (row._count as { deliveries: number })?.deliveries ?? 0,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
  }
}

export async function listWebhooks(): Promise<WebhookDTO[]> {
  await requirePermission('settings:manage')
  const rows = await prisma.webhook.findMany({
    include: { _count: { select: { deliveries: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((r) => toDTO(r as unknown as Record<string, unknown>))
}

export async function getWebhook(id: string): Promise<WebhookDTO> {
  await requirePermission('settings:manage')
  const row = await prisma.webhook.findUnique({
    where: { id },
    include: { _count: { select: { deliveries: true } } },
  })
  if (!row) throw new NotFoundError('Webhook')
  return toDTO(row as unknown as Record<string, unknown>)
}

export async function createWebhook(data: {
  name: string
  url: string
  secret?: string
  events: string[]
  retryCount?: number
  timeoutSec?: number
  isActive?: boolean
  createdBy: string
}): Promise<string> {
  const user = await requirePermission('settings:manage')
  const row = await prisma.webhook.create({
    data: {
      name: data.name,
      url: data.url,
      secret: data.secret ?? randomBytes(32).toString('hex'),
      events: data.events,
      retryCount: data.retryCount ?? 3,
      timeoutSec: data.timeoutSec ?? 10,
      isActive: data.isActive ?? true,
      createdBy: data.createdBy,
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'WEBHOOK_CREATED',
    userId: user.id,
    resource: 'Webhook',
    resourceId: row.id,
  })

  return row.id
}

export async function updateWebhook(
  id: string,
  data: {
    name?: string
    url?: string
    secret?: string
    events?: string[]
    retryCount?: number
    timeoutSec?: number
    isActive?: boolean
  },
): Promise<WebhookDTO> {
  await requirePermission('settings:manage')
  const existing = await prisma.webhook.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Webhook')

  const row = await prisma.webhook.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.secret !== undefined && { secret: data.secret }),
      ...(data.events !== undefined && { events: data.events }),
      ...(data.retryCount !== undefined && { retryCount: data.retryCount }),
      ...(data.timeoutSec !== undefined && { timeoutSec: data.timeoutSec }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  })
  return toDTO(row as unknown as Record<string, unknown>)
}

export async function deleteWebhook(id: string): Promise<void> {
  const user = await requirePermission('settings:manage')
  const existing = await prisma.webhook.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Webhook')

  await prisma.webhook.delete({ where: { id } })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'WEBHOOK_DELETED',
    userId: user.id,
    resource: 'Webhook',
    resourceId: id,
  })
}

export async function rotateWebhookSecret(id: string): Promise<string> {
  await requirePermission('settings:manage')
  const existing = await prisma.webhook.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('Webhook')

  const secret = randomBytes(32).toString('hex')
  await prisma.webhook.update({
    where: { id },
    data: { secret },
  })
  return secret
}

export async function testWebhook(id: string): Promise<{ status: number | null; error: string | null }> {
  await requirePermission('settings:manage')
  const wh = await prisma.webhook.findUnique({ where: { id } })
  if (!wh) throw new NotFoundError('Webhook')

  const body = JSON.stringify({
    event: 'test',
    payload: { message: 'This is a test webhook from ClientConnect' },
    sentAt: new Date().toISOString(),
  })

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), (wh.timeoutSec || 10) * 1000)
    const resp = await fetch(wh.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'ClientConnect-Webhook/1.0' },
      body,
      signal: controller.signal,
    })
    clearTimeout(timer)
    return { status: resp.status, error: null }
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function listWebhookDeliveries(
  webhookId: string,
  page = 1,
  pageSize = 20,
): Promise<{ items: Array<Record<string, unknown>>; total: number }> {
  await requirePermission('settings:manage')
  const [items, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where: { webhookId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.webhookDelivery.count({ where: { webhookId } }),
  ])
  return { items, total }
}
