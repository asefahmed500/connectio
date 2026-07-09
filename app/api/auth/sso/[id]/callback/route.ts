import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/auth/tokens'
import { NotFoundError } from '@/lib/errors'
import { rateLimit } from '@/lib/ratelimit'

// GET /api/auth/sso/:id/callback — OIDC callback (IdP redirects here)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const provider = await prisma.ssoProvider.findUnique({ where: { id } })
  if (!provider) throw new NotFoundError('SsoProvider')
  if (!provider.isActive) {
    return NextResponse.json({ error: 'SSO provider is disabled' }, { status: 403 })
  }
  if (provider.providerType !== 'oidc') {
    return NextResponse.json({ error: 'This provider does not support OIDC callbacks' }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  const rl = await rateLimit(`sso-callback:ip:${ip}`, { limit: 10, window: 300 })
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const state = req.nextUrl.searchParams.get('state')
  const code = req.nextUrl.searchParams.get('code')
  const error = req.nextUrl.searchParams.get('error')

  if (error) {
    console.error(`[SSO] OIDC error from ${provider.name}: ${error}`)
    return NextResponse.redirect(new URL('/login?error=sso_denied', req.url))
  }

  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 })
  }

  // Exchange authorization code for tokens using the OIDC provider
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/auth/sso/${id}/callback`

  // We attempt to exchange the code for an ID token by calling the token endpoint
  // Derived from the OIDC discovery URL
  const tokenEndpoint = await discoverTokenEndpoint(provider.oidcDiscoveryUrl)

  if (!tokenEndpoint) {
    return NextResponse.json({ error: 'Could not discover token endpoint' }, { status: 500 })
  }

  try {
    const tokenResponse = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: provider.oidcClientId ?? '',
        client_secret: provider.oidcClientSecret ?? '',
      }),
    })

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text()
      console.error(`[SSO] Token exchange failed: ${text}`)
      return NextResponse.redirect(new URL('/login?error=sso_failed', req.url))
    }

    const tokens = await tokenResponse.json()
    const idToken = tokens.id_token as string | undefined

    if (!idToken) {
      return NextResponse.json({ error: 'No id_token in response' }, { status: 400 })
    }

    // Decode the JWT (without verification for initial implementation)
    // In production, verify against the IdP's JWKS
    const payload = decodeJwtPayload(idToken)
    const email = payload?.email as string | undefined

    if (!email) {
      return NextResponse.json({ error: 'ID token missing email' }, { status: 400 })
    }

    return handleSsoLogin(provider, email, req)
  } catch (err) {
    console.error('[SSO] OIDC callback failed:', err)
    return NextResponse.redirect(new URL('/login?error=sso_error', req.url))
  }
}

async function discoverTokenEndpoint(discoveryUrl: string | null): Promise<string | null> {
  if (!discoveryUrl) return null

  try {
    const resp = await fetch(discoveryUrl, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const config = await resp.json()
    return config.token_endpoint as string
  } catch {
    return null
  }
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf-8'))
  } catch {
    return null
  }
}

async function handleSsoLogin(
  provider: { id: string; jitProvisioning: boolean; defaultRole: string; name: string },
  email: string,
  req: NextRequest,
) {
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  if (!user) {
    if (!provider.jitProvisioning) {
      return NextResponse.redirect(new URL('/login?error=not_found', req.url))
    }

    const tempPassword = generatePassword()
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: email.split('@')[0] ?? email,
        passwordHash: await hashPassword(tempPassword),
        role: provider.defaultRole as import('@prisma/client').UserRole,
        ssoProviderId: provider.id,
      },
    })
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role as import('@prisma/client').UserRole,
    tokenVersion: user.tokenVersion,
  })
  const refreshToken = generateRefreshToken()
  const refreshTokenHash = await hashRefreshToken(refreshToken)

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const response = NextResponse.redirect(new URL('/dashboard', req.url))
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60,
  })
  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  })

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  return response
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let result = ''
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
