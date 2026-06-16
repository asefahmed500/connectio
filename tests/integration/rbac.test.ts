// Integration tests for the RBAC / data-isolation boundary (lib/dal/session).
// Exercises the REAL auth path: signed access token → getCurrentUser →
// tokenVersion check → requireRole / requireClientAccess, against the
// connectio_test database.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeUser, makeClient, makeTeamMember, assignTeam } from '../lib/db'
import { getClientDTO, listAllClients } from '@/lib/dal/clients'
import { requireRole, requireClientAccess } from '@/lib/dal/session'

beforeEach(async () => {
  await truncateAll()
})

afterEach(() => {
  signOut()
})

describe('requireRole', () => {
  it('allows a SUPER_ADMIN into a SUPER_ADMIN-gated function', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    const result = await listAllClients()
    expect(result.items).toHaveLength(0)
  })

  it('rejects a TEAM_MEMBER from a SUPER_ADMIN-gated function', async () => {
    const tm = await makeTeamMember()
    await signInAs(tm.user)
    await expect(listAllClients()).rejects.toThrow()
  })

  it('rejects a CLIENT from a SUPER_ADMIN-gated function', async () => {
    const c = await makeClient()
    await signInAs(c.user)
    await expect(listAllClients()).rejects.toThrow()
  })
})

describe('requireClientAccess', () => {
  it('allows SUPER_ADMIN to access any client', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    const target = await makeClient()
    await signInAs(admin)
    const dto = await getClientDTO(target.client.id)
    expect(dto?.id).toBe(target.client.id)
  })

  it('allows a CLIENT to access their own client only', async () => {
    const mine = await makeClient()
    const other = await makeClient()
    await signInAs(mine.user)
    expect((await getClientDTO(mine.client.id))?.id).toBe(mine.client.id)
    await expect(getClientDTO(other.client.id)).rejects.toThrow()
  })

  it('allows a TEAM_MEMBER only for assigned clients', async () => {
    const tm = await makeTeamMember()
    const assigned = await makeClient()
    const unassigned = await makeClient()
    await assignTeam(tm.teamMember.id, assigned.client.id)
    await signInAs(tm.user)

    expect((await getClientDTO(assigned.client.id))?.id).toBe(assigned.client.id)
    await expect(getClientDTO(unassigned.client.id)).rejects.toThrow()
  })

  it('requireRole returns the user for an allowed role', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    const u = await requireRole('SUPER_ADMIN')
    expect(u.id).toBe(admin.id)
  })
})

describe('tokenVersion invalidation', () => {
  it('rejects a token whose ver does not match the DB', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN', tokenVersion: 1 })
    // Sign with version 1, then bump the DB version out from under it.
    await signInAs(admin)
    await requireRole('SUPER_ADMIN') // works with matching version

    // Simulate a force-logout / role change: bump tokenVersion in the DB.
    const { prisma } = await import('@/lib/db')
    await prisma.user.update({ where: { id: admin.id }, data: { tokenVersion: 2 } })

    // The cached user from the first call could mask this; reset modules to
    // force getCurrentUser to re-read the DB.
    const { getCurrentUser } = await import('@/lib/dal/session')
    const stale = await getCurrentUser()
    // After a version bump, getCurrentUser must reject the stale token.
    expect(stale).toBeNull()
  })
})
