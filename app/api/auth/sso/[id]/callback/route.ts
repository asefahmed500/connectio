import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes, randomUUID } from 'crypto'
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/auth/tokens'
import { dashboardForRole } from '@/lib/auth/session'
import { SCIM_ALLOWED_ROLES } from '@/lib/dal/sso'
import { rateLimit } from '@/lib/ratelimit'
import { NotFoundError } from '@/lib/errors'
import type { UserRole } from '@prisma/client'

// GET /api/auth/sso/:id/callback — OIDC callback (IdP redirects here)
//
// SECURITY: the id_token returned by the IdP is fully verified:
//   - signature against the IdP JWKS (no alg confusion, no alg=none)
//   - iss matches provider.oidcIssuer
//   - aud matches provider.oidcClientId
//   - exp not expired
//   - email claim present
// AND `state` is round-trip-verified against the cookie set by /initiate.
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

  // STATE CSRF CHECK: the cookie must equal the query param.
  const cs = await cookies()
  const cookieState = cs.get(`sso_state_${id}`)?.value
  cs.delete(`sso_state_${id}`)
  if (!cookieState || cookieState !== state) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectUri = `${baseUrl}/api/auth/sso/${id}/callback`

  const discovery = await fetchDiscovery(provider.oidcDiscoveryUrl)
  if (!discovery) {
    return NextResponse.json({ error: 'Could not discover OIDC endpoints' }, { status: 500 })
  }

  try {
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: provider.oidcClientId ?? '',
        client_secret: provider.oidcClientSecret ?? '',
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!tokenResponse.ok) {
      const text = await tokenResponse.text()
      console.error(`[SSO] Token exchange failed: ${text}`)
      return NextResponse.redirect(new URL('/login?error=sso_failed', req.url))
    }

    const tokens = (await tokenResponse.json()) as { id_token?: string }
    const idToken = tokens.id_token
    if (!idToken) {
      return NextResponse.json({ error: 'No id_token in response' }, { status: 400 })
    }

    // VERIFY THE id_token SIGNATURE against the IdP JWKS, plus iss/aud/exp.
    const expectedIssuer = provider.oidcIssuer ?? discovery.issuer
    const expectedAudience = provider.oidcClientId ?? ''
    const jwks = createRemoteJWKSet(new URL(discovery.jwks_uri))
    let payload
    try {
      ;({ payload } = await jwtVerify(idToken, jwks, {
        issuer: expectedIssuer,
        audience: expectedAudience,
        algorithms: ['RS256', 'ES256', 'RS384', 'ES384', 'PS256'],
        clockTolerance: 60,
      }))
    } catch (err) {
      console.warn('[SSO] id_token verification failed:', err instanceof Error ? err.message : err)
      return NextResponse.redirect(new URL('/login?error=sso_invalid_token', req.url))
    }

    const email = (payload.email as string | undefined)?.toLowerCase()
    if (!email) {
      return NextResponse.redirect(new URL('/login?error=sso_no_email', req.url))
    }

    return handleSsoLogin(provider, email, req)
  } catch (err) {
    console.error('[SSO] OIDC callback failed:', err)
    return NextResponse.redirect(new URL('/login?error=sso_error', req.url))
  }
}

async function fetchDiscovery(
  discoveryUrl: string | null,
): Promise<{ token_endpoint: string; jwks_uri: string; issuer: string } | null> {
  if (!discoveryUrl) return null
  try {
    const resp = await fetch(discoveryUrl, { signal: AbortSignal.timeout(5000) })
    if (!resp.ok) return null
    const config = (await resp.json()) as {
      token_endpoint?: string
      jwks_uri?: string
      issuer?: string
    }
    if (!config.token_endpoint || !config.jwks_uri) return null
    return {
      token_endpoint: config.token_endpoint,
      jwks_uri: config.jwks_uri,
      issuer: config.issuer ?? '',
    }
  } catch {
    return null
  }
}

async function handleSsoLogin(
  provider: {
    id: string
    jitProvisioning: boolean
    defaultRole: string
    name: string
  },
  email: string,
  req: NextRequest,
) {
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  if (!user) {
    if (!provider.jitProvisioning) {
      return NextResponse.redirect(new URL('/login?error=not_found', req.url))
    }

    const role: UserRole = (SCIM_ALLOWED_ROLES as readonly string[]).includes(provider.defaultRole)
      ? (provider.defaultRole as UserRole)
      : 'TEAM_MEMBER'

    const tempPassword = generatePassword()
    user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name: email.split('@')[0] ?? email,
        passwordHash: await hashPassword(tempPassword),
        role,
        ssoProviderId: provider.id,
      },
    })
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    role: user.role as UserRole,
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

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SSO_LOGIN_SUCCESS',
    userId: user.id,
    resource: 'SsoProvider',
    resourceId: provider.id,
  })

  const dest = dashboardForRole(user.role as UserRole, undefined)
  const response = NextResponse.redirect(new URL(dest, req.url))
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

  return response
}

function generatePassword(): string {
  return randomBytes(18).toString('base64url')
}

// Exported for the OIDC initiator to use the same cookie name convention.
export const ssoStateCookieName = (id: string) => `sso_state_${id}` as const

// Utility used by initiator (kept here to keep the state-cookie contract in one file).
export function newSsoState(): string {
  return randomUUID()
}

export function newPkceVerifier(): string {
  return randomBytes(32).toString('base64url')
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return Buffer.from(digest).toString('base64url').replace(/=/g, '')
}

// Re-export jose errors for initiator / tests
export { joseErrors }
