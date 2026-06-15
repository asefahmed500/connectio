import 'server-only'
import { headers } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

type TxClient = Omit<Prisma.TransactionClient, '$transaction'>

export async function writeAudit(
  params: {
    action: string
    userId: string | null
    resource: string
    resourceId: string
    changes?: { before?: unknown; after?: unknown }
  },
  tx?: TxClient,
): Promise<void> {
  const client = tx ?? prisma
  const [ip, userAgent] = await Promise.all([readIp(), readUserAgent()])

  await client.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      changes: (params.changes as object) ?? undefined,
      ip,
      userAgent,
    },
  })
}

async function readIp(): Promise<string | null> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? null
}

async function readUserAgent(): Promise<string | null> {
  const h = await headers()
  return h.get('user-agent')
}
