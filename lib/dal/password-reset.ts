import 'server-only'
import { prisma } from '@/lib/db'
import { hashRefreshToken, signResetToken } from '@/lib/auth/tokens'
import { hashPassword } from '@/lib/auth/password'
import { writeAudit } from '@/lib/audit'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'

const RESET_TOKEN_TTL_MS = 10 * 60 * 1000 // 10 minutes for OTP validity

function generateOtp(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const num = (bytes[0] << 24 | bytes[1] << 16 | bytes[2] << 8 | bytes[3]) >>> 0
  return String(100000 + (num % 900000))
}

export async function createPasswordResetOtp(email: string): Promise<{
  rawOtp: string
  userExists: boolean
}> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  })

  if (!user) return { rawOtp: '', userExists: false }

  // Delete any existing unused tokens for this user.
  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  })

  const otp = generateOtp()
  const tokenHash = await hashRefreshToken(otp)

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

  return { rawOtp: otp, userExists: true }
}

export async function verifyResetOtp(email: string, otp: string): Promise<{
  ok: boolean
  error?: string
  resetTokenCookie?: string
}> {
  const rl = await rateLimitAll(
    rateLimit(`reset-otp:${email.toLowerCase()}`, { limit: 5, window: 60 }),
  )
  if (!rl.ok) {
    return { ok: false, error: 'Too many attempts. Please wait a minute.' }
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  })
  if (!user) return { ok: false, error: 'Invalid or expired verification code.' }

  const tokenHash = await hashRefreshToken(otp)

  const record = await prisma.passwordResetToken.findFirst({
    where: { userId: user.id, tokenHash, usedAt: null },
    select: { id: true, expiresAt: true },
  })

  if (!record) return { ok: false, error: 'Invalid or expired verification code.' }
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })
    return { ok: false, error: 'This verification code has expired. Request a new one.' }
  }

  const resetTokenCookie = await signResetToken(record.id)
  return { ok: true, resetTokenCookie }
}

export async function resetPassword(opts: {
  newPassword: string
}): Promise<{ ok: boolean; error?: string }> {
  const { verifyResetTokenCookie } = await import('@/lib/auth/tokens')
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const resetToken = cookieStore.get('reset_token')?.value

  const verified = await verifyResetTokenCookie(resetToken)
  if (!verified.ok) {
    return { ok: false, error: 'Session expired. Please start over.' }
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { id: verified.claims!.pwdResetId },
    include: { user: { select: { id: true, tokenVersion: true } } },
  })

  if (!record) return { ok: false, error: 'Invalid or expired reset session.' }
  if (record.usedAt) return { ok: false, error: 'This reset has already been used.' }
  if (record.expiresAt < new Date()) {
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    })
    return { ok: false, error: 'This reset has expired. Request a new code.' }
  }

  const passwordHash = await hashPassword(opts.newPassword)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.user.id },
      data: {
        passwordHash,
        tokenVersion: record.user.tokenVersion + 1,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.session.updateMany({
      where: { userId: record.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ])

  // Clear the reset cookie
  cookieStore.set('reset_token', '', { maxAge: 0, path: '/' })

  await writeAudit({
    action: 'PASSWORD_RESET_COMPLETED',
    userId: record.user.id,
    resource: 'User',
    resourceId: record.user.id,
  })

  return { ok: true }
}
