// Integration tests for lib/dal/team — create/assign/unassign, SUPER_ADMIN gated.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeClient, makeTeamMember, makeUser } from '../lib/db'
import { prisma } from '@/lib/db'
import {
  listAllTeamMembers,
  createTeamMember,
  assignTeamToClient,
  unassignTeamFromClient,
} from '@/lib/dal/team'

beforeEach(async () => {
  await truncateAll()
})
afterEach(() => signOut())

describe('listAllTeamMembers', () => {
  it('is SUPER_ADMIN only', async () => {
    await makeTeamMember()
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    expect((await listAllTeamMembers()).total).toBeGreaterThanOrEqual(1)
  })

  it('rejects a TEAM_MEMBER', async () => {
    const tm = await makeTeamMember()
    await signInAs(tm.user)
    await expect(listAllTeamMembers()).rejects.toThrow()
  })
})

describe('createTeamMember', () => {
  it('creates a user + team member as SUPER_ADMIN', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    const { id } = await createTeamMember({
      name: 'New Hire',
      email: 'newhire@test.local',
      password: 'TempPass!2026',
      department: 'Design',
    })
    const tm = await prisma.teamMember.findUnique({
      where: { id },
      include: { user: true },
    })
    expect(tm?.user.role).toBe('TEAM_MEMBER')
    expect(tm?.department).toBe('Design')
  })

  it('rejects a non-admin', async () => {
    const c = await makeClient()
    await signInAs(c.user)
    await expect(
      createTeamMember({ name: 'X', email: 'x@test.local', password: 'TempPass!2026' }),
    ).rejects.toThrow()
  })
})

describe('assign / unassign', () => {
  it('assigns a team member to a client (idempotent) then unassigns', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    const c = await makeClient()
    const tm = await makeTeamMember()
    await signInAs(admin)

    await assignTeamToClient({ clientId: c.client.id, teamMemberId: tm.teamMember.id })
    // Idempotent: assigning again does not duplicate (composite unique).
    await assignTeamToClient({ clientId: c.client.id, teamMemberId: tm.teamMember.id })
    const count = await prisma.teamAssignment.count({
      where: { clientId: c.client.id, teamMemberId: tm.teamMember.id },
    })
    expect(count).toBe(1)

    await unassignTeamFromClient({ clientId: c.client.id, teamMemberId: tm.teamMember.id })
    const after = await prisma.teamAssignment.count({
      where: { clientId: c.client.id, teamMemberId: tm.teamMember.id },
    })
    expect(after).toBe(0)
  })

  it('rejects assignment by a non-admin', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await signInAs(tm.user)
    await expect(
      assignTeamToClient({ clientId: c.client.id, teamMemberId: tm.teamMember.id }),
    ).rejects.toThrow()
  })
})
