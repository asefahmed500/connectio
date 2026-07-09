import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { NotFoundError } from '@/lib/errors'

// GET /api/auth/sso/:id/initiate — start SSO login (redirect to IdP)
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
    if (!provider.idpSsoUrl) {
      return NextResponse.redirect(new URL('/login?error=sso_not_configured', _req.url))
    }
    // SAML HTTP-Redirect binding: redirect to IdP SSO URL
    return NextResponse.redirect(provider.idpSsoUrl)
  }

  if (provider.providerType === 'oidc') {
    if (!provider.oidcDiscoveryUrl || !provider.oidcClientId) {
      return NextResponse.redirect(new URL('/login?error=sso_not_configured', _req.url))
    }

    try {
      const discResp = await fetch(provider.oidcDiscoveryUrl, {
        signal: AbortSignal.timeout(5000),
      })
      if (!discResp.ok) {
        return NextResponse.redirect(new URL('/login?error=sso_discovery_failed', _req.url))
      }

      const disc = await discResp.json()
      const authorizeUrl = disc.authorization_endpoint as string
      if (!authorizeUrl) {
        return NextResponse.redirect(new URL('/login?error=sso_config_error', _req.url))
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      const redirectUri = `${baseUrl}/api/auth/sso/${id}/callback`
      const state = crypto.randomUUID()

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: provider.oidcClientId,
        redirect_uri: redirectUri,
        scope: 'openid email profile',
        state,
      })

      return NextResponse.redirect(`${authorizeUrl}?${params.toString()}`)
    } catch {
      return NextResponse.redirect(new URL('/login?error=sso_error', _req.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=sso_unknown', _req.url))
}
