// POST /api/auth/refresh
// Rotates refresh token; issues new access token. Called by the client when an
// access token expires.
//
// Security properties:
//   - Rate-limited per IP (60/min) so a stolen refresh token can't be hammered.
//   - Origin/Host check prevents CSRF (refresh is a cookie-authenticated POST).
//   - Rotation is race-safe via row-level conditional update.
//   - Reuse detection: presenting an already-revoked refresh token revokes the
//     ENTIRE session family for that user (token-theft defense).
//   - Defense-in-depth: rejects when user.isActive=false or tokenVersion changed,
//     independent of the block-bumps-tokenVersion invariant.

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
  try {
    // 1. CSRF: Origin must match Host (not X-Forwarded-Host — that header is
    //    attacker-controllable on misconfigured proxies).
    const h = await headers()
    const host = h.get('host')
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

    // 3. Read refresh cookie, look up session by hash.
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

    if (!session) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // REUSE DETECTION: presenting an already-revoked token means the token was
    // stolen and the legitimate client already rotated. Revoke the entire
    // family and force re-authentication.
    if (session.revokedAt) {
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      // Bump tokenVersion so any in-flight access tokens also die.
      await prisma.user.update({
        where: { id: session.userId },
        data: { tokenVersion: { increment: 1 } },
      })
      console.warn(
        `[auth/refresh] reuse detected for user ${session.userId}; session family revoked.`,
      )
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (session.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // DEFENSE-IN-DEPTH: even if some block path forgot to revoke sessions, the
    // refresh handler still rejects blocked users and stale token versions.
    if (!session.user.isActive) {
      await prisma.session.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // 4. Rotate: revoke the presented session AND only succeed if it wasn't
    //    concurrently revoked. The conditional updateMany is the race-safe
    //    primitive: if another request rotated it first, count=0.
    const rotateResult = await prisma.session.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (rotateResult.count === 0) {
      // Lost the race — another request already rotated this session. Treat
      // as invalid so the client re-authenticates.
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    // 5. Issue new access token + new refresh session.
    const newRefresh = generateRefreshToken()
    const newRefreshHash = await hashRefreshToken(newRefresh)

    await prisma.session.create({
      data: {
        userId: session.userId,
        refreshTokenHash: newRefreshHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

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
  } catch (err) {
    console.error('[auth/refresh] failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
