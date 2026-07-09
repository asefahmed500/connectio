// Backfill for audit chain hashing.
// Run once after migration: npx tsx scripts/backfill-audit-hashes.ts
//
// Processes entries in chronological order so the chain links correctly.

import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

function computeHash(input: {
  id: string
  previousHash: string | null
  userId: string | null
  action: string
  resource: string
  resourceId: string
  changes: unknown
  ip: string | null
  userAgent: string | null
  createdAt: Date
}): string {
  const changes = input.changes as Record<string, unknown> | null
  const payload = [
    input.previousHash ?? '',
    input.id,
    input.userId ?? '',
    input.action,
    input.resource,
    input.resourceId,
    JSON.stringify(changes ?? {}, Object.keys(changes ?? {}).sort()),
    input.ip ?? '',
    input.userAgent ?? '',
    input.createdAt.toISOString(),
  ].join('|')
  return createHash('sha256').update(payload, 'utf-8').digest('hex')
}

async function main() {
  console.log('Fetching all audit log entries...')
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Found ${rows.length} entries.`)

  let updated = 0
  let previousHash: string | null = null

  for (const row of rows) {
    const hash = computeHash({
      id: row.id,
      previousHash,
      userId: row.userId,
      action: row.action,
      resource: row.resource,
      resourceId: row.resourceId,
      changes: row.changes,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
    })

    await prisma.auditLog.update({
      where: { id: row.id },
      data: { previousHash, hash },
    })

    previousHash = hash
    updated++
  }

  console.log(`Backfilled ${updated} entries.`)
  console.log('Chain head hash:', previousHash)
}

main()
  .catch((err) => {
    console.error('Backfill failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
