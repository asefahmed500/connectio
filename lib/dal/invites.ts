import 'server-only'
import { prisma } from '@/lib/db'
import { slugify, isValidSlug, randomSlug } from '@/lib/slug'

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
