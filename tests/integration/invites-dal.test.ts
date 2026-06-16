// Integration tests for lib/dal/invites — slug uniqueness and registration gating.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { truncateAll, makeClient } from '../lib/db'
import { prisma } from '@/lib/db'
import { proposeSlug, getInviteForRegistration } from '@/lib/dal/invites'

beforeEach(async () => {
  await truncateAll()
})

async function makeInvite(opts: {
  slug?: string
  status?: 'OPEN' | 'CONSUMED' | 'EXPIRED' | 'REVOKED'
  expiresAt?: Date
  email?: string
}) {
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000)
  return prisma.invite.create({
    data: {
      email: opts.email ?? 'invitee@test.local',
      companyName: 'Co',
      contactName: 'Contact',
      slug: opts.slug ?? `invite-${Math.random().toString(36).slice(2)}`,
      status: opts.status ?? 'OPEN',
      createdBy: 'seed',
      expiresAt,
    },
    select: { slug: true, id: true },
  })
}

describe('proposeSlug', () => {
  it('returns a usable slug derived from the contact/company name', async () => {
    const slug = await proposeSlug({ contactName: 'Jane Smith', companyName: 'Acme Corp' })
    expect(slug).toMatch(/^[a-z0-9-]+$/)
  })

  it('avoids slugs already taken by a client', async () => {
    await makeClient({ companyName: 'Taken Company' })
    const slug = await proposeSlug({ contactName: '', companyName: '' })
    // Whatever it returns must not collide with the existing client slug.
    const clash = await prisma.client.findUnique({ where: { uniqueSlug: slug } })
    expect(clash).toBeNull()
  })
})

describe('getInviteForRegistration', () => {
  it('returns an OPEN, unexpired invite', async () => {
    const inv = await makeInvite({ status: 'OPEN' })
    const got = await getInviteForRegistration(inv.slug)
    expect(got?.slug).toBe(inv.slug)
  })

  it('returns null for a CONSUMED invite', async () => {
    const inv = await makeInvite({ status: 'CONSUMED' })
    expect(await getInviteForRegistration(inv.slug)).toBeNull()
  })

  it('lazily expires an OPEN invite past its expiresAt and returns null', async () => {
    const inv = await makeInvite({ status: 'OPEN', expiresAt: new Date(Date.now() - 1000) })
    expect(await getInviteForRegistration(inv.slug)).toBeNull()
    const row = await prisma.invite.findUnique({ where: { id: inv.id } })
    expect(row?.status).toBe('EXPIRED')
  })

  it('returns null for an unknown slug', async () => {
    expect(await getInviteForRegistration('does-not-exist')).toBeNull()
  })
})
