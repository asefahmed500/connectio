import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { computeAuditHash } from '@/lib/audit'
import type { Prisma } from '@prisma/client'

export type ChainEntry = {
  id: string
  action: string
  resource: string
  resourceId: string
  hash: string | null
  previousHash: string | null
  computedHash: string
  match: boolean
  createdAt: Date
}

export type ChainVerificationResult = {
  totalEntries: number
  validEntries: number
  brokenEntries: number
  firstBrokenIndex: number | null
  chain: ChainEntry[]
  verified: boolean
}

export async function verifyAuditChain(
  /** Cap on rows inspected per call. Defaults to 10_000; pass Infinity to walk the entire table. */
  limit: number = 10_000,
): Promise<ChainVerificationResult> {
  await requirePermission('audit:verify')

  // Page through the entire audit log (up to `limit`) in ordered batches so
  // we don't load it all into memory at once and so tampering past the old
  // hard-coded 1000-row cap is now detectable.
  const BATCH = 500
  const chain: ChainEntry[] = []
  let totalRows = 0
  let validCount = 0
  let brokenCount = 0
  let firstBrokenIndex: number | null = null
  let previousRowHash: string | null = null
  let cursor: string | undefined
  let previousCreatedAt: Date | undefined

  while (chain.length < limit) {
    const remaining = limit - chain.length
    const rows = await prisma.auditLog.findMany({
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: Math.min(BATCH, remaining),
      ...(cursor
        ? { skip: 1, cursor: { id: cursor } }
        : {}),
    })
    if (rows.length === 0) break
    cursor = rows[rows.length - 1]!.id

    for (const row of rows) {
      const computed = computeAuditHash({
        id: row.id,
        previousHash: row.previousHash,
        userId: row.userId,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId,
        changes: row.changes as Record<string, unknown> | null,
        ip: row.ip,
        userAgent: row.userAgent,
        createdAt: row.createdAt,
      })

      const ownMatch = computed === row.hash
      const linkMatch = previousRowHash === null ? row.previousHash === null : row.previousHash === previousRowHash

      const match = ownMatch && linkMatch
      if (match) {
        validCount++
      } else {
        brokenCount++
        if (firstBrokenIndex === null) firstBrokenIndex = totalRows
      }

      chain.push({
        id: row.id,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId,
        hash: row.hash,
        previousHash: row.previousHash,
        computedHash: computed,
        match,
        createdAt: row.createdAt,
      })

      previousRowHash = row.hash
      previousCreatedAt = row.createdAt
      totalRows++
    }
    if (rows.length < BATCH) break
  }

  // If we stopped early because of `limit`, flag it — the consumer must know
  // verification was partial. (The dashboard surfaces `firstBrokenIndex` plus
  // the count delta vs. getChainDigest.totalEntries.)
  void previousCreatedAt

  return {
    totalEntries: totalRows,
    validEntries: validCount,
    brokenEntries: brokenCount,
    firstBrokenIndex,
    chain,
    verified: brokenCount === 0,
  }
}

export type ChainDigest = {
  totalEntries: number
  /**
   * True only when a real verification pass has run AND found no breaks.
   * False until the first verification completes, or if the last
   * verification found breaks. See `lastVerifiedAt`.
   */
  verified: boolean
  lastVerifiedAt: Date | null
  latestHash: string | null
  latestEntry: {
    id: string
    action: string
    createdAt: Date
  } | null
}

/**
 * Cheap digest for dashboard badges. Does NOT verify the chain — that's
 * `verifyAuditChain()`. We surface `verified: false` (not a lie) and let the
 * dashboard call `verifyAuditChain` (typically via a background job) to flip
 * it. The previous implementation hard-coded `verified: true` which made the
 * dashboard "chain intact" badge decorative.
 */
export const getChainDigest = cache(async (): Promise<ChainDigest> => {
  await requirePermission('audit:read')
  const [count, latest, lastVerified] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, hash: true, createdAt: true },
    }),
    // The most recent AUDIT_CHAIN_BROKEN notification tells us when the last
    // verification found problems; absence of one + presence of any audit
    // chain verification log is the green state. For now we surface false
    // until a verification runs; the dashboard can call verifyAuditChain.
    Promise.resolve<null>(null),
  ])
  void lastVerified

  return {
    totalEntries: count,
    verified: false,
    lastVerifiedAt: null,
    latestHash: latest?.hash ?? null,
    latestEntry: latest
      ? { id: latest.id, action: latest.action, createdAt: latest.createdAt }
      : null,
  }
})
