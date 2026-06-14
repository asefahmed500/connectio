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

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { client: { select: { id: true, uniqueSlug: true } } },
  })

  // verifyPassword handles the null case via the dummy hash → constant time.
  const valid = await verifyPassword(user?.passwordHash ?? null, password)
  if (!user || !valid) {
    return { error: 'Invalid email or password.' }
  }

  // GC expired sessions opportunistically.
  await prisma.session.deleteMany({
    where: { userId: user.id, expiresAt: { lt: new Date() } },
  })

  await createSession({
    userId: user.id,
    role: user.role,
    clientId: user.client?.id,
    tokenVersion: user.tokenVersion,
    ip,
    userAgent: (await headers()).get('user-agent'),
  })

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  await writeAudit({
    action: 'USER_LOGIN',
    userId: user.id,
    resource: 'User',
    resourceId: user.id,
  })

  // REVIEW.md §3.4 (role-change propagation): tokenVersion is embedded in the JWT
  // and checked on every getCurrentUser() call, so a demoted user's session
  // invalidates immediately when their tokenVersion bumps.
  redirect(dashboardForRole(user.role, user.client?.uniqueSlug) || next)
}
