import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/auth/tokens'
import { verifySamlResponse } from '@/lib/auth/saml'
import { dashboardForRole } from '@/lib/auth/session'
import { SCIM_ALLOWED_ROLES } from '@/lib/dal/sso'
import { NotFoundError } from '@/lib/errors'
import type { UserRole } from '@prisma/client'

// POST /api/auth/sso/:id/acs — SAML ACS endpoint (IdP posts SAMLResponse here)
//
// SECURITY: the SAML response MUST carry an XMLDSig signature that verifies
// against the provider's configured IdP certificate, AND pass audience /
// recipient / time checks. Unsigned assertions are rejected.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const provider = await prisma.ssoProvider.findUnique({ where: { id } })
  if (!provider) throw new NotFoundError('SsoProvider')
  if (!provider.isActive) {
    return NextResponse.json({ error: 'SSO provider is disabled' }, { status: 403 })
  }
  if (provider.providerType !== 'saml') {
    return NextResponse.json({ error: 'This endpoint is for SAML providers' }, { status: 400 })
  }
  if (!provider.idpCertificate) {
    // Refuse to authenticate against a provider with no configured cert.
    return NextResponse.json(
      { error: 'SSO provider is missing its IdP certificate — contact your administrator.' },
      { status: 503 },
    )
  }

  const formData = await req.formData()
  const samlResponse = formData.get('SAMLResponse') as string | null
  if (!samlResponse) {
    return NextResponse.json({ error: 'Missing SAMLResponse' }, { status: 400 })
  }

  // Decode the SAML response (base64 -> XML)
  const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8')

  // Build our ACS URL for the Recipient check.
  const acsUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/auth/sso/${id}/acs`

  const verified = verifySamlResponse({
    xml: decoded,
    idpCertificate: provider.idpCertificate,
    spEntityId: provider.spEntityId,
    acsUrl,
  })
  if (!verified.ok) {
    console.warn(`[SSO] SAML verification failed for provider ${id}: ${verified.reason}`)
    return NextResponse.json(
      { error: 'SAML response verification failed.' },
      { status: 401 },
    )
  }

  const email = verified.email?.toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'SAML assertion missing email' }, { status: 400 })
  }

  return handleSsoLogin(provider, email, req)
}

async function handleSsoLogin(
  provider: {
    id: string
    jitProvisioning: boolean
    defaultRole: string
    name: string
    spEntityId: string
  },
  email: string,
  req: NextRequest,
) {
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  if (!user) {
    if (!provider.jitProvisioning) {
      console.warn(`[SSO] Login blocked for unknown user ${email} (JIT disabled)`)
      return NextResponse.redirect(new URL('/login?error=not_found', req.url))
    }

    // JIT provisioning. Never allow SUPER_ADMIN via federated identity.
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

  // Generate tokens and create session
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

  // Redirect to the role's actual dashboard (not the legacy /dashboard route).
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
  // Cryptographically secure temporary password.
  return randomBytes(18).toString('base64url')
}
