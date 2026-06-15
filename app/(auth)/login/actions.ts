'use server'

import { z } from 'zod'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { verifyPassword } from '@/lib/auth/password'
import { createSession, dashboardForRole } from '@/lib/auth/session'
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
  if (!parsed.success) return { error: 'Please enter a valid email and password.' }

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

  let loginUser: Awaited<ReturnType<typeof prisma.user.findUnique<{
    where: { email: string }
    include: { client: { select: { id: true; uniqueSlug: true } } }
  }>>>
  try {
    loginUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { client: { select: { id: true, uniqueSlug: true } } },
    })

    // verifyPassword handles the null case via the dummy hash → constant time.
    const valid = await verifyPassword(loginUser?.passwordHash ?? null, password)
    if (!loginUser || !valid) {
      return { error: 'Invalid email or password.' }
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
  } catch (err) {
    console.error('[login] failed:', err)
    return { error: 'Something went wrong. Please try again.' }
  }

  // Redirect to role dashboard, or to `next` if it's under the user's own route prefix.
  const dash = dashboardForRole(loginUser.role, loginUser.client?.uniqueSlug)
  if (next && next !== '/' && next !== dash && next.startsWith(dash)) {
    redirect(next)
  }
  redirect(dash)
}
