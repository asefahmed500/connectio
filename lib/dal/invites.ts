import 'server-only'
import { prisma } from '@/lib/db'
import { slugify, isValidSlug, randomSlug } from '@/lib/slug'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import { requirePermission } from '@/lib/auth/permissions'
import type { Prisma } from '@prisma/client'

/**
 * Proposes a unique slug for an invite. Tries contact name → company name →
 * contact name + random suffix → fully random. Returns the first available.
 */
export async function proposeSlug(input: {
  contactName: string
  companyName: string
}): Promise<string> {
  const candidates = [
    slugify(input.contactName),
    slugify(input.companyName),
    `${slugify(input.contactName)}-${randomSlug(4)}`,
    `${slugify(input.companyName)}-${randomSlug(4)}`,
    randomSlug(8),
    randomSlug(12),
  ].filter(isValidSlug)

  // Batch-check all candidates in 2 queries instead of 2×N.
  const [existingInvites, existingClients] = await Promise.all([
    prisma.invite.findMany({
      where: { slug: { in: candidates } },
      select: { slug: true },
    }),
    prisma.client.findMany({
      where: { uniqueSlug: { in: candidates } },
      select: { uniqueSlug: true },
    }),
  ])

  const taken = new Set([
    ...existingInvites.map((i) => i.slug),
    ...existingClients.map((c) => c.uniqueSlug),
  ])

  for (const c of candidates) {
    if (!taken.has(c)) return c
  }
  // randomSlug(12) gives 36^12 ≈ 4.7e18 options; this is unreachable.
  throw new Error('Failed to generate a unique slug')
}

export type InviteForRegistration = {
  slug: string
  email: string
  companyName: string
  contactName: string
}

/**
 * Returns the invite if it's usable for registration. Lazily marks OPEN invites
 * past their expiresAt as EXPIRED. Returns null otherwise.
 */
export type InviteDTO = {
  id: string
  email: string
  companyName: string
  contactName: string
  slug: string
  status: string
  createdBy: string
  createdAt: Date
  expiresAt: Date
}

export async function listInvites(
  params?: PaginationParams & { search?: string; status?: string }
): Promise<PaginatedResult<InviteDTO>> {
  await requirePermission('invite:create')
  const { take, skip } = paginationParams(params)

  const where: Prisma.InviteWhereInput = {}
  if (params?.search) {
    where.OR = [
      { email: { contains: params.search, mode: 'insensitive' } },
      { companyName: { contains: params.search, mode: 'insensitive' } },
    ]
  }
  if (params?.status) {
    where.status = params.status as unknown as import('@prisma/client').InviteStatus
  }

  const [rows, total] = await Promise.all([
    prisma.invite.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
    }),
    prisma.invite.count({ where }),
  ])

  return toPaginated(rows, total, params)
}

export type CreateInviteInput = {
  email: string
  companyName: string
  contactName: string
}

export async function createInvite(
  input: CreateInviteInput & { createdBy: string }
): Promise<{ id: string; slug: string }> {
  const slug = await proposeSlug(input)
  const { getNumberSetting } = await import('@/lib/dal/settings')
  const ttlDays = await getNumberSetting('inviteTtlDays')
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000)

  const invite = await prisma.invite.create({
    data: {
      email: input.email.toLowerCase(),
      companyName: input.companyName,
      contactName: input.contactName,
      slug,
      createdBy: input.createdBy,
      expiresAt,
    },
  })

  return { id: invite.id, slug: invite.slug }
}

export async function resendInvite(invite: {
  slug: string
  contactName: string
  companyName: string
  email: string
}): Promise<void> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const inviteUrl = `${base}/invite/${invite.slug}`

  const { renderInviteEmail } = await import('@/lib/email-templates')
  const tpl = await renderInviteEmail({
    contactName: invite.contactName,
    companyName: invite.companyName,
    inviteUrl,
  })

  const { sendEmail } = await import('@/lib/email')
  await sendEmail({ to: invite.email, subject: tpl.subject, text: tpl.text, html: tpl.html })
}

export async function getInviteForRegistration(
  slug: string,
): Promise<InviteForRegistration | null> {
  const invite = await prisma.invite.findUnique({ where: { slug } })
  if (!invite) return null

  if (invite.status === 'OPEN' && invite.expiresAt < new Date()) {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { status: 'EXPIRED' },
    })
    return null
  }

  if (invite.status !== 'OPEN') return null

  return {
    slug: invite.slug,
    email: invite.email,
    companyName: invite.companyName,
    contactName: invite.contactName,
  }
}
