import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { NotFoundError } from '@/lib/errors'
import { newSsoState, newPkceVerifier, pkceChallenge, ssoStateCookieName } from '../callback/route'

// GET /api/auth/sso/:id/initiate — start SSO login (redirect to IdP)
//
// SECURITY:
//   - OIDC: sets a signed `state` cookie + PKCE verifier so the callback can
//     verify both. Also adds `code_challenge` (S256) to the authorize request.
//   - Validates all admin-configured IdP URLs are https (or localhost in dev)
//     before redirecting or fetching — blocks SSRF and open-redirect via
//     tampered SSO config.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const provider = await prisma.ssoProvider.findUnique({ where: { id } })
  if (!provider) throw new NotFoundError('SsoProvider')
  if (!provider.isActive) {
    return NextResponse.redirect(new URL('/login?error=sso_disabled', _req.url))
  }

  if (provider.providerType === 'saml') {
    if (!provider.idpSsoUrl || !isSafeRedirect(provider.idpSsoUrl)) {
      return NextResponse.redirect(new URL('/login?error=sso_not_configured', _req.url))
    }
    return NextResponse.redirect(provider.idpSsoUrl)
  }

  if (provider.providerType === 'oidc') {
    if (!provider.oidcDiscoveryUrl || !provider.oidcClientId) {
      return NextResponse.redirect(new URL('/login?error=sso_not_configured', _req.url))
    }
    if (!isHttpsUrl(provider.oidcDiscoveryUrl)) {
      return NextResponse.redirect(new URL('/login?error=sso_config_error', _req.url))
    }

    try {
      const discResp = await fetch(provider.oidcDiscoveryUrl, {
        signal: AbortSignal.timeout(5000),
      })
      if (!discResp.ok) {
        return NextResponse.redirect(new URL('/login?error=sso_discovery_failed', _req.url))
      }

      const disc = (await discResp.json()) as { authorization_endpoint?: string }
      const authorizeUrl = disc.authorization_endpoint
      if (!authorizeUrl || !isSafeRedirect(authorizeUrl)) {
        return NextResponse.redirect(new URL('/login?error=sso_config_error', _req.url))
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const redirectUri = `${baseUrl}/api/auth/sso/${id}/callback`
      const state = newSsoState()
      const verifier = newPkceVerifier()
      const challenge = await pkceChallenge(verifier)

      // Set state + PKCE verifier in short-lived HttpOnly cookies so the
      // callback can verify both.
      const cs = await cookies()
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge: 10 * 60, // 10 min is generous for an OIDC round-trip
      }
      cs.set(ssoStateCookieName(id), state, cookieOpts)
      cs.set(`sso_pkce_${id}`, verifier, cookieOpts)

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: provider.oidcClientId,
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })

      return NextResponse.redirect(`${authorizeUrl}?${params.toString()}`)
    } catch {
      return NextResponse.redirect(new URL('/login?error=sso_error', _req.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=sso_unknown', _req.url))
}

/**
 * Allows https URLs always, and http URLs only when targeting localhost in
 * non-production. Used for redirects (idpSsoUrl, authorizeUrl).
 */
function isSafeRedirect(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:' && process.env.NODE_ENV !== 'production' && isLoopback(u.hostname)) return true
    return false
  } catch {
    return false
  }
}

/**
 * Allows https URLs always, and http URLs only when targeting localhost in
 * non-production. Used for server-side fetches (discovery URL).
 */
function isHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol === 'https:') return true
    if (u.protocol === 'http:' && process.env.NODE_ENV !== 'production' && isLoopback(u.hostname)) return true
    return false
  } catch {
    return false
  }
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1'
  )
}
