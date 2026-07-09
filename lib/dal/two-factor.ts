import 'server-only'
import { prisma } from '@/lib/db'
import { getCurrentUser } from '@/lib/dal/session'
import { requirePermission } from '@/lib/auth/permissions'
import { verifyPassword } from '@/lib/auth/password'
import {
  generateTotpSecret,
  getTotpAuthUri,
  verifyTotp,
  generateBackupCodes,
  hashBackupCodes,
  normalizeBackupCode,
} from '@/lib/auth/totp'

export type TwoFactorStatus = {
  enabled: boolean
  pending: boolean
  secret?: string
  uri?: string
  backupCodes?: string[]
}

/**
 * Begin enrollment: generate a pending secret for the current user.
 * Does not enable 2FA until the user verifies a code.
 */
export async function beginTwoFactorEnrollment(): Promise<{ secret: string; uri: string }> {
  const user = await requirePermission('profile:update')
  const secret = generateTotpSecret()
  const uri = getTotpAuthUri(secret, user.email)

  await prisma.user.update({
    where: { id: user.id },
    data: { totpPendingSecret: secret },
  })

  return { secret, uri }
}

/**
 * Complete enrollment: verify the code against the pending secret,
 * then enable 2FA and store backup codes.
 */
export async function completeTwoFactorEnrollment(code: string): Promise<{ backupCodes: string[] }> {
  const user = await requirePermission('profile:update')

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpPendingSecret: true },
  })
  if (!current?.totpPendingSecret) {
    throw new Error('No pending enrollment. Start setup first.')
  }

  if (!verifyTotp(current.totpPendingSecret, code)) {
    throw new Error('Invalid code. Please try again.')
  }

  const backupCodes = generateBackupCodes()
  const hashed = await hashBackupCodes(backupCodes)

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: true,
      totpSecret: current.totpPendingSecret,
      totpPendingSecret: null,
      backupCodes: hashed,
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'USER_2FA_ENABLED',
    userId: user.id,
    resource: 'User',
    resourceId: user.id,
  })

  return { backupCodes }
}

export async function disableTwoFactor(password: string): Promise<void> {
  const user = await requirePermission('profile:update')

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  })
  if (!current) throw new Error('User not found')

  const valid = await verifyPassword(current.passwordHash, password)
  if (!valid) throw new Error('Current password is incorrect.')

  await prisma.user.update({
    where: { id: user.id },
    data: {
      totpEnabled: false,
      totpSecret: null,
      totpPendingSecret: null,
      backupCodes: [],
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'USER_2FA_DISABLED',
    userId: user.id,
    resource: 'User',
    resourceId: user.id,
  })
}

export async function getTwoFactorStatus(): Promise<TwoFactorStatus> {
  const user = await getCurrentUser()
  if (!user) return { enabled: false, pending: false }

  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { totpEnabled: true, totpPendingSecret: true },
  })

  return {
    enabled: row?.totpEnabled ?? false,
    pending: !!row?.totpPendingSecret,
  }
}
