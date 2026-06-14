import 'server-only'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'

/**
 * Writes an audit log entry. Currently writes directly to the DB.
 *
 * Tier 1.5 (REVIEW-4.md §6.1) routes this through the transactional outbox
 * for tamper-evidence (hash chain + WORM storage). The signature won't change;
 * only the internal delivery mechanism will.
 *
 * Call from inside Server Actions / Route Handlers. Avoid calling during render.
 */
export async function writeAudit(params: {
  action: string
  userId: string | null
  resource: string
  resourceId: string
  changes?: { before?: unknown; after?: unknown }
}): Promise<void> {
  const [ip, userAgent] = await Promise.all([readIp(), readUserAgent()])

  await prisma.auditLog.create({
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
