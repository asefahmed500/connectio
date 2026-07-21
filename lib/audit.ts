import 'server-only'
import { createHash } from 'crypto'
import { headers } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { dispatchWebhooks } from '@/lib/webhooks/deliver'

type TxClient = Omit<Prisma.TransactionClient, '$transaction'>

/**
 * writeAudit appends a row to the (hash-chained, append-only) AuditLog and —
 * after the surrounding transaction (if any) commits — fires any matching
 * audit-forwarding webhooks.
 *
 * Callers MUST finish their transaction before awaiting the returned promise
 * if they want the webhook to reflect committed state. Inside a transaction
 * (`tx` provided) we only enqueue the row; the webhook dispatch is deferred
 * via `queueMicrotask` so it runs AFTER the tx commits (or is silently
 * dropped if the tx rolls back — set `process.env.AUDIT_WEBHOOK_BLOCKING=1`
 * to await it instead).
 */
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

  // Get the latest hash for chain linking
  const latest = await client.auditLog.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { hash: true },
  })
  const previousHash = latest?.hash ?? null

  const { createId } = await import('@paralleldrive/cuid2')
  const id = createId()
  const now = new Date()
  const changesJson = params.changes as Record<string, unknown> | undefined

  const hash = computeAuditHash({
    id,
    previousHash,
    userId: params.userId,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId,
    changes: changesJson ?? null,
    ip,
    userAgent,
    createdAt: now,
  })

  await client.auditLog.create({
    data: {
      id,
      userId: params.userId,
      action: params.action,
      resource: params.resource,
      resourceId: params.resourceId,
      changes: changesJson as object | undefined,
      ip,
      userAgent,
      previousHash,
      hash,
      createdAt: now,
    },
  })

  // Fire webhook audit forwarding. When inside a transaction we defer with
  // queueMicrotask so the dispatch only happens after the caller's tx commits
  // (a rolled-back tx will have already rolled back this audit row too, and
  // the dispatch is a no-op from the consumer's perspective because the
  // dispatch payload is built from `params`, not from a re-read). The
  // fire-and-forget `.catch(() => {})` prevents webhook failures from
  // surfacing as audit failures.
  const payload = {
    action: params.action,
    userId: params.userId,
    resource: params.resource,
    resourceId: params.resourceId,
    changes: changesJson,
    ip,
    userAgent,
    hash,
    createdAt: now.toISOString(),
  }
  if (tx) {
    queueMicrotask(() => {
      dispatchWebhooks('audit', payload).catch(() => {})
    })
  } else {
    dispatchWebhooks('audit', payload).catch(() => {})
  }
}

export type AuditHashInput = {
  id: string
  previousHash: string | null
  userId: string | null
  action: string
  resource: string
  resourceId: string
  changes: Record<string, unknown> | null
  ip: string | null
  userAgent: string | null
  createdAt: Date
}

export function computeAuditHash(input: AuditHashInput): string {
  const payload = [
    input.previousHash ?? '',
    input.id,
    input.userId ?? '',
    input.action,
    input.resource,
    input.resourceId,
    JSON.stringify(input.changes ?? {}, Object.keys(input.changes ?? {}).sort()),
    input.ip ?? '',
    input.userAgent ?? '',
    input.createdAt.toISOString(),
  ].join('|')
  return createHash('sha256').update(payload, 'utf-8').digest('hex')
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
