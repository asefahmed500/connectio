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
  limit = 1000,
): Promise<ChainVerificationResult> {
  await requirePermission('audit:verify')

  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  let validCount = 0
  let brokenCount = 0
  let firstBrokenIndex: number | null = null

  const chain: ChainEntry[] = rows.map((row, i) => {
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

    // Also verify the previousHash link (entry i's previousHash must match entry i-1's hash)
    let linkMatch = true
    if (i > 0) {
      linkMatch = row.previousHash === rows[i - 1].hash
    }

    const ownMatch = computed === row.hash
    const match = ownMatch && linkMatch

    if (match) {
      validCount++
    } else {
      brokenCount++
      if (firstBrokenIndex === null) firstBrokenIndex = i
    }

    return {
      id: row.id,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      hash: row.hash,
      previousHash: row.previousHash,
      computedHash: computed,
      match,
      createdAt: row.createdAt,
    }
  })

  return {
    totalEntries: rows.length,
    validEntries: validCount,
    brokenEntries: brokenCount,
    firstBrokenIndex,
    chain,
    verified: brokenCount === 0,
  }
}

export type ChainDigest = {
  totalEntries: number
  verified: boolean
  latestHash: string | null
  latestEntry: {
    id: string
    action: string
    createdAt: Date
  } | null
}

export const getChainDigest = cache(async (): Promise<ChainDigest> => {
  await requirePermission('audit:read')
  const [count, latest] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { id: true, action: true, hash: true, createdAt: true },
    }),
  ])

  return {
    totalEntries: count,
    verified: true,
    latestHash: latest?.hash ?? null,
    latestEntry: latest
      ? { id: latest.id, action: latest.action, createdAt: latest.createdAt }
      : null,
  }
})
