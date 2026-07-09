'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { createSession, dashboardForRole } from '@/lib/auth/session'
import { verifyMfaToken } from '@/lib/auth/tokens'
import { verifyTotp, normalizeBackupCode, hashBackupCodes } from '@/lib/auth/totp'
import { writeAudit } from '@/lib/audit'

export type TwoFactorState = { error?: string } | undefined

function readIp(): string | undefined {
  // headers() is async in Next 15+, but keep best-effort here
  return undefined
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

  // Try TOTP first, then a backup code.
  let verified = verifyTotp(user.totpSecret, code)

  if (!verified) {
    const normalized = normalizeBackupCode(code)
    const hashes = await hashBackupCodes([normalized])
    const match = user.backupCodes.findIndex((h) => h === hashes[0])
    if (match >= 0) {
      verified = true
      // Consume the used backup code.
      const remaining = user.backupCodes.filter((_, i) => i !== match)
      await prisma.user.update({
        where: { id: user.id },
        data: { backupCodes: remaining },
      })
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
    ip: readIp(),
    userAgent: null,
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
  if (next && next !== '/' && next.startsWith(dash)) {
    redirect(next)
  }
  redirect(dash)
}
