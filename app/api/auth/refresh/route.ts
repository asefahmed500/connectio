// POST /api/auth/refresh
// Rotates refresh token; issues new access token. Called by the client when an
// access token expires.
//
// REVIEW.md §3.11 fixes baked in:
//   - Rate-limited per IP (60/min) so a stolen refresh token can't be hammered.
//   - Origin/Host check prevents CSRF (refresh is a cookie-authenticated POST).
//
// REVIEW.md §3.2 (rotation race) is partially mitigated here by revoking old
// and creating new in a transaction. Full idempotency on reuse-detection lands
// with the idempotency milestone (#24).

import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/auth/tokens'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'

export const runtime = 'nodejs'

async function readIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'unknown'
}

function checkOrigin(host: string | null, origin: string | null): boolean {
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  // 1. CSRF: Origin must match Host (or X-Forwarded-Host).
  const h = await headers()
  const host = h.get('host') ?? h.get('x-forwarded-host')
  const origin = h.get('origin')
  if (!checkOrigin(host, origin)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }

  // 2. Rate limit by IP — refresh storms shouldn't be allowed.
  const ip = await readIp()
  const rl = await rateLimitAll(
    rateLimit(`refresh:ip:${ip}`, { limit: 60, window: 60 }),
  )
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many refresh attempts' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    )
  }

  // 3. Read refresh cookie, look up session.
  const cs = await cookies()
  const refreshCookie = cs.get('refresh_token')?.value
  if (!refreshCookie) {
    return NextResponse.json({ error: 'No refresh token' }, { status: 401 })
  }

  const refreshHash = await hashRefreshToken(refreshCookie)
  const session = await prisma.session.findFirst({
    where: { refreshTokenHash: refreshHash },
    include: { user: { include: { client: { select: { id: true } } } } },
  })

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  // 4. Rotate: revoke old, create new, in one transaction.
  const newRefresh = generateRefreshToken()
  const newRefreshHash = await hashRefreshToken(newRefresh)

  await prisma.$transaction([
    prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    }),
    prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }),
  ])

  // 5. Issue new access token with current role + tokenVersion from DB.
  const access = await signAccessToken({
    sub: session.user.id,
    role: session.user.role,
    clientId: session.user.client?.id,
    tokenVersion: session.user.tokenVersion,
  })

  const res = NextResponse.json({ ok: true })
  res.cookies.set('access_token', access, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  })
  res.cookies.set('refresh_token', newRefresh, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
