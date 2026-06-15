import 'server-only'
import { prisma } from '@/lib/db'
import { generateRefreshToken, hashRefreshToken } from '@/lib/auth/tokens'
import { hashPassword } from '@/lib/auth/password'
import { writeAudit } from '@/lib/audit'

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000 // 1 hour

export async function createPasswordResetToken(email: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  })
  if (!user) return null

  // Delete any existing unused tokens for this user — one active reset at a time.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  })

  const token = generateRefreshToken()
  const tokenHash = await hashRefreshToken(token)

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  })

  await writeAudit({
    action: 'PASSWORD_RESET_TOKEN_CREATED',
    userId: user.id,
    resource: 'PasswordResetToken',
    resourceId: tokenHash.slice(0, 8),
  })

  return token
}

export async function resetPassword(opts: {
  token: string
  newPassword: string
}): Promise<{ ok: boolean; error?: string }> {
  const tokenHash = await hashRefreshToken(opts.token)

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, tokenVersion: true } } },
  })

  if (!record) return { ok: false, error: 'Invalid or expired reset link.' }
  if (record.usedAt) return { ok: false, error: 'This reset link has already been used.' }
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })
    return { ok: false, error: 'This reset link has expired.' }
  }

  const passwordHash = await hashPassword(opts.newPassword)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash,
        tokenVersion: record.user.tokenVersion + 1, // Invalidate all existing sessions
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Revoke all sessions for security
    prisma.session.updateMany({
      where: { userId: record.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  await writeAudit({
    action: 'PASSWORD_RESET_COMPLETED',
    userId: record.user.id,
    resource: 'User',
    resourceId: record.user.id,
  })

  return { ok: true }
}

export async function verifyResetToken(token: string): Promise<boolean> {
  const tokenHash = await hashRefreshToken(token)
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { usedAt: true, expiresAt: true },
  })
  if (!record || record.usedAt) return false
  if (record.expiresAt < new Date()) return false
  return true
}
