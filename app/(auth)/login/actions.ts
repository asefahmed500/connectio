'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
// `isRedirectError` is not part of the public `next/navigation` surface in
// this Next version. The private `next/dist/...` path is the official escape
// hatch documented by the Next team for detecting NEXT_REDIRECT throws in
// server actions that also return state. Re-evaluate on each Next upgrade.
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, dashboardForRole } from '@/lib/auth/session'
import { signMfaToken } from '@/lib/auth/tokens'
import { writeAudit } from '@/lib/audit'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'

const Schema = z.object({
  email: z.email(),
  password: z.string().min(1),
  next: z.string().default('/'),
})

export type LoginState =
  | undefined
  | { error: string }

async function readIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0]!.trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = Schema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  })
  if (!parsed.success) {
    const issues = parsed.error.issues
    if (issues.some((i) => i.path.includes('email'))) {
      return { error: 'Please enter a valid email address.' }
    }
    return { error: 'Please enter your password.' }
  }

  const { email, password, next } = parsed.data
  const ip = await readIp()

  // Rate-limit BEFORE the DB lookup so we don't give away cheap user-existence oracles.
  const rl = await rateLimitAll(
    rateLimit(`login:ip:${ip}`, { limit: 10, window: 60 }),
    rateLimit(`login:email:${email.toLowerCase()}`, { limit: 5, window: 300 }),
  )
  if (!rl.ok) {
    return { error: `Too many attempts. Try again in ${rl.retryAfter}s.` }
  }

  try {
    const loginUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
        tokenVersion: true,
        isActive: true,
        totpEnabled: true,
        client: { select: { id: true, uniqueSlug: true } },
      },
    })

    // verifyPassword handles the null case via the dummy hash → constant time.
    const valid = await verifyPassword(loginUser?.passwordHash ?? null, password)
    if (!loginUser || !valid) {
      return { error: 'Invalid email or password.' }
    }

    if (!loginUser.isActive) {
      return { error: 'Your account has been blocked. Contact your administrator.' }
    }

    // If 2FA is enabled, issue a short-lived MFA-pending token and redirect to
    // the challenge page instead of creating a full session.
    if (loginUser.totpEnabled) {
      const mfaToken = await signMfaToken({
        sub: loginUser.id,
        role: loginUser.role,
        clientId: loginUser.client?.id,
        tokenVersion: loginUser.tokenVersion,
      })
      const cs = await cookies()
      cs.set('mfa_token', mfaToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 5 * 60,
      })
      redirect(next && next !== '/' ? `/login/2fa?next=${encodeURIComponent(next)}` : '/login/2fa')
    }

    // Enforce admin 2FA requirement from SystemSetting.
    const { getBooleanSetting } = await import('@/lib/dal/settings')
    const requireAdmin2fa = await getBooleanSetting('requireAdminTwoFactor')
    if (requireAdmin2fa && loginUser.role === 'SUPER_ADMIN' && !loginUser.totpEnabled) {
      return { error: 'Your admin account requires two-factor authentication. Contact your administrator to enable it.' }
    }

    // GC expired sessions opportunistically.
    await prisma.session.deleteMany({
      where: { userId: loginUser.id, expiresAt: { lt: new Date() } },
    })

    await createSession({
      userId: loginUser.id,
      role: loginUser.role,
      clientId: loginUser.client?.id,
      tokenVersion: loginUser.tokenVersion,
      ip,
      userAgent: (await headers()).get('user-agent'),
    })

    await prisma.user.update({
      where: { id: loginUser.id },
      data: { lastLoginAt: new Date() },
    })

    await writeAudit({
      action: 'USER_LOGIN',
      userId: loginUser.id,
      resource: 'User',
      resourceId: loginUser.id,
    })

    // Redirect to role dashboard, or to `next` if it's under the user's own route prefix.
    const dash = dashboardForRole(loginUser.role, loginUser.client?.uniqueSlug)
    if (next && next !== '/' && next !== dash && next.startsWith(dash)) {
      redirect(next)
    }
    redirect(dash)
  } catch (err) {
    // redirect() throws NEXT_REDIRECT internally — must propagate to the framework.
    if (isRedirectError(err)) throw err
    console.error('[login] failed:', err)
    return { error: 'Something went wrong. Please try again.' }
  }
}
