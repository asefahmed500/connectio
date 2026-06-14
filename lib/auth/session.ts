import 'server-only'
import { cookies } from 'next/headers'
import type { UserRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} from '@/lib/auth/tokens'

export const ACCESS_COOKIE = 'access_token'
export const REFRESH_COOKIE = 'refresh_token'

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

const accessCookieOpts = { ...cookieOptions, maxAge: 60 * 60 * 24 }
const refreshCookieOpts = { ...cookieOptions, maxAge: 60 * 60 * 24 * 7 }

export async function createSession(opts: {
  userId: string
  role: UserRole
  clientId?: string
  tokenVersion: number
  ip?: string | null
  userAgent?: string | null
}): Promise<void> {
  const access = await signAccessToken({
    sub: opts.userId,
    role: opts.role,
    clientId: opts.clientId,
    tokenVersion: opts.tokenVersion,
  })
  const refresh = generateRefreshToken()
  const refreshHash = await hashRefreshToken(refresh)

  await prisma.session.create({
    data: {
      userId: opts.userId,
      refreshTokenHash: refreshHash,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
    },
  })

  const cs = await cookies()
  cs.set(ACCESS_COOKIE, access, accessCookieOpts)
  cs.set(REFRESH_COOKIE, refresh, refreshCookieOpts)
}

export async function deleteSession(): Promise<void> {
  const cs = await cookies()
  const refresh = cs.get(REFRESH_COOKIE)?.value
  if (refresh) {
    const hash = await hashRefreshToken(refresh)
    await prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }
  cs.delete(ACCESS_COOKIE)
  cs.delete(REFRESH_COOKIE)
}

export function dashboardForRole(role: UserRole, clientSlug?: string): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return '/admin'
    case 'TEAM_MEMBER':
      return '/team'
    case 'CLIENT':
      return clientSlug ? `/dashboard/visitor/${clientSlug}` : '/'
  }
}
