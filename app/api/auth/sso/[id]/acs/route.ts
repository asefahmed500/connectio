import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { signAccessToken, generateRefreshToken, hashRefreshToken } from '@/lib/auth/tokens'
import { NotFoundError } from '@/lib/errors'

// POST /api/auth/sso/:id/acs — SAML ACS endpoint (IdP posts SAMLResponse here)
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

  const formData = await req.formData()
  const samlResponse = formData.get('SAMLResponse') as string | null
  if (!samlResponse) {
    return NextResponse.json({ error: 'Missing SAMLResponse' }, { status: 400 })
  }

  // Decode the SAML response (base64 -> XML)
  const decoded = Buffer.from(samlResponse, 'base64').toString('utf-8')

  // Parse the NameID / email from the SAML assertion
  const email = extractEmailFromSaml(decoded)
  if (!email) {
    await recordFailedLogin(id, 'SAML assertion missing email/NameID')
    return NextResponse.json({ error: 'SAML assertion missing email' }, { status: 400 })
  }

  return handleSsoLogin(provider, email, req)
}

function extractEmailFromSaml(xml: string): string | null {
  // Try NameID first
  const nameIdMatch = xml.match(/<saml:NameID[^>]*>([^<]+)<\/saml:NameID>/)
  if (nameIdMatch) return nameIdMatch[1]

  // Try email attribute
  const emailMatch = xml.match(/<saml:Attribute[^>]*Name="email"[^>]*>.*?<saml:AttributeValue[^>]*>([^<]+)<\/saml:AttributeValue>/s)
  if (emailMatch) return emailMatch[1]

  return null
}

async function handleSsoLogin(
  provider: { id: string; jitProvisioning: boolean; defaultRole: string; name: string },
  email: string,
  req: NextRequest,
) {
  let user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })

  if (!user) {
    if (!provider.jitProvisioning) {
      await recordFailedLogin(provider.id, `User ${email} not found and JIT off`)
      return NextResponse.json({ error: 'Account not found. Contact your administrator.' }, { status: 403 })
    }

    // JIT provisioning: create the user
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

  // Generate tokens and create session
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

async function recordFailedLogin(providerId: string, reason: string) {
  console.error(`[SSO] Login failed for provider ${providerId}: ${reason}`)
}

function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let result = ''
  for (let i = 0; i < 24; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
