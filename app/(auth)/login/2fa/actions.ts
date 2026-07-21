'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { createSession, dashboardForRole } from '@/lib/auth/session'
import { verifyMfaToken } from '@/lib/auth/tokens'
import { verifyTotp, normalizeBackupCode, hashBackupCodes } from '@/lib/auth/totp'
import { writeAudit } from '@/lib/audit'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'

export type TwoFactorState = { error?: string } | undefined

async function readIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export async function verifyTwoFactorAction(
  _prev: TwoFactorState,
  formData: FormData,
): Promise<TwoFactorState> {
  const cs = await cookies()
  const mfaToken = cs.get('mfa_token')?.value

  const { ok, claims } = await verifyMfaToken(mfaToken)
  if (!ok || !claims) {
    return { error: 'Your verification session expired. Please sign in again.' }
  }

  // Rate-limit per subject AND per IP before any verification to prevent
  // TOTP brute-force and backup-code guessing.
  const ip = await readIp()
  const rl = await rateLimitAll(
    rateLimit(`2fa:sub:${claims.sub}`, { limit: 5, window: 60 }),
    rateLimit(`2fa:ip:${ip}`, { limit: 10, window: 60 }),
  )
  if (!rl.ok) {
    return { error: `Too many attempts. Try again in ${rl.retryAfter}s.` }
  }

  const code = (formData.get('code') as string) ?? ''
  const next = (formData.get('next') as string) ?? ''

  const user = await prisma.user.findUnique({
    where: { id: claims.sub, deletedAt: null },
    select: {
      id: true,
      role: true,
      totpSecret: true,
      totpEnabled: true,
      backupCodes: true,
      tokenVersion: true,
      client: { select: { id: true, uniqueSlug: true } },
    },
  })

  if (!user || !user.totpEnabled || !user.totpSecret) {
    return { error: 'Two-factor authentication is not enabled for this account.' }
  }

  // Try TOTP first (constant-time comparison happens inside hotp on HMAC output).
  let verified = verifyTotp(user.totpSecret, code)

  if (!verified) {
    // Backup-code path. Use atomic consume to avoid the race where two
    // concurrent requests both see the same unused code.
    const normalized = normalizeBackupCode(code)
    const hashes = await hashBackupCodes([normalized])
    const candidateHash = hashes[0]!
    if (user.backupCodes.includes(candidateHash)) {
      // Atomic consume — only succeeds if the hash is still present.
      const consumed = await consumeBackupCode(user.id, candidateHash)
      verified = consumed
    }
  }

  if (!verified) {
    await writeAudit({
      action: 'USER_2FA_FAILED',
      userId: user.id,
      resource: 'User',
      resourceId: user.id,
    })
    return { error: 'Invalid verification code.' }
  }

  // Issue the real session now that 2FA passed.
  await createSession({
    userId: user.id,
    role: user.role,
    clientId: user.client?.id,
    tokenVersion: user.tokenVersion,
    ip: await readIp(),
    userAgent: (await headers()).get('user-agent'),
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  await writeAudit({
    action: 'USER_LOGIN',
    userId: user.id,
    resource: 'User',
    resourceId: user.id,
  })

  // Clear the MFA-pending cookie.
  cs.delete('mfa_token')

  const dash = dashboardForRole(user.role, user.client?.uniqueSlug)
  if (next && next !== '/' && next.startsWith(dash) && !next.startsWith('//')) {
    redirect(next)
  }
  redirect(dash)
}

/**
 * Atomic single-use enforcement for backup codes. Uses a conditional update
 * that only fires if the hash is still present. Returns true if the code was
 * actually present and consumed.
 */
async function consumeBackupCode(userId: string, hash: string): Promise<boolean> {
  // Re-fetch the user and remove the hash only if it's still there.
  // $transaction + conditional updateMany guarantees atomicity.
  const result = await prisma.$transaction(async (tx) => {
    const fresh = await tx.user.findUnique({
      where: { id: userId },
      select: { backupCodes: true },
    })
    if (!fresh || !fresh.backupCodes.includes(hash)) return false
    await tx.user.update({
      where: { id: userId },
      data: { backupCodes: fresh.backupCodes.filter((h) => h !== hash) },
    })
    return true
  })
  return result
}
