'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { hashPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session'
import { writeAudit } from '@/lib/audit'
import { rateLimit, rateLimitAll } from '@/lib/ratelimit'

const Schema = z.object({
  slug: z.string().min(3).max(32).regex(/^[a-z0-9-]+$/),
  email: z.email(),
  name: z.string().min(1).max(120),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .regex(/[A-Za-z]/, 'Include at least one letter')
    .regex(/\d/, 'Include at least one number')
    .regex(/[^A-Za-z0-9]/, 'Include at least one symbol'),
})

export type RegisterFieldErrors = z.inferFlattenedErrors<
  typeof Schema
>['fieldErrors']

export type RegisterState =
  | undefined
  | { error: string }
  | { fields?: RegisterFieldErrors; error?: undefined }

// Sentinel errors thrown from inside the transaction. Caught and mapped to
// user-facing RegisterState below. (Throwing strings here is intentional — we
// don't want to leak internal details via error messages.)
const INVITE_INVALID = 'INVITE_INVALID'
const EMAIL_MISMATCH = 'EMAIL_MISMATCH'
const EMAIL_TAKEN = 'EMAIL_TAKEN'

export async function registerAction(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const parsed = Schema.safeParse({
    slug: formData.get('slug'),
    email: formData.get('email'),
    name: formData.get('name'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { fields: parsed.error.flatten().fieldErrors }
  }

  const { slug, email, name, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? h.get('x-real-ip')
    ?? 'unknown'
  const rl = await rateLimitAll(
    rateLimit(`invite-reg:ip:${ip}`, { limit: 5, window: 300 }),
    rateLimit(`invite-reg:email:${normalizedEmail}`, { limit: 3, window: 600 }),
  )
  if (!rl.ok) {
    return { error: `Too many attempts. Try again in ${rl.retryAfter}s.` }
  }

  // Hash BEFORE the transaction — argon2 is ~80ms and we don't want to hold a
  // Postgres transaction open during it.
  const passwordHash = await hashPassword(password)

  // Single transaction: validate invite → create user+client → consume invite.
  // Returns { result, inviteCreatedBy } so the post-tx notify() knows who to ping.
  const txResult = await prisma
    .$transaction(async (tx) => {
      const invite = await tx.invite.findUnique({ where: { slug } })
      if (!invite || invite.status !== 'OPEN' || invite.expiresAt < new Date()) {
        throw new Error(INVITE_INVALID)
      }
      if (invite.email.toLowerCase() !== normalizedEmail) {
        throw new Error(EMAIL_MISMATCH)
      }
      const existing = await tx.user.findUnique({ where: { email: normalizedEmail } })
      if (existing) throw new Error(EMAIL_TAKEN)

      const created = await tx.user.create({
        data: {
          email: normalizedEmail,
          name,
          passwordHash,
          role: 'CLIENT',
          client: {
            create: {
              companyName: invite.companyName,
              contactName: invite.contactName,
              uniqueSlug: invite.slug,
              invite: { connect: { id: invite.id } },
            },
          },
        },
        include: { client: true },
      })

      await tx.invite.update({
        where: { id: invite.id },
        data: { status: 'CONSUMED', consumedBy: created.id },
      })

      return { result: created, inviteCreatedBy: invite.createdBy }
    })
    .then(
      (val) => val,
      (err: Error) => {
        if (err.message === INVITE_INVALID) return { __error: INVITE_INVALID } as const
        if (err.message === EMAIL_MISMATCH) return { __error: EMAIL_MISMATCH } as const
        if (err.message === EMAIL_TAKEN) return { __error: EMAIL_TAKEN } as const
        throw err
      },
    )

  if ('__error' in txResult) {
    if (txResult.__error === INVITE_INVALID) return { error: 'This invite link is no longer valid.' }
    if (txResult.__error === EMAIL_MISMATCH) return { error: 'Email does not match the invite.' }
    if (txResult.__error === EMAIL_TAKEN) return { error: 'An account with this email already exists.' }
  }

  const { result: user, inviteCreatedBy } = txResult

  // Outside tx: create session, audit log. Cookie writes must not block commit.
  await createSession({
    userId: user.id,
    role: user.role,
    clientId: user.client!.id,
    tokenVersion: user.tokenVersion,
  })

  await writeAudit({
    action: 'USER_REGISTERED',
    userId: user.id,
    resource: 'User',
    resourceId: user.id,
  })

  // Notify the admin who created the invite.
  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'INVITE_CONSUMED',
    actorId: user.id,
    clientId: user.client!.id,
    inviteCreatedBy,
    companyName: user.client!.companyName,
  })

  // REVIEW.md §3.4 (role-change propagation): a freshly registered user starts
  // at tokenVersion=0; if their role ever changes, getCurrentUser() rejects
  // their old JWT on the next request.
  redirect(`/dashboard/visitor/${user.client!.uniqueSlug}`)
}
