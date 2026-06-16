// Integration tests for lib/dal/files — list/download RBAC and delete RBAC.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeClient, makeUser, makeTeamMember, assignTeam } from '../lib/db'
import { listFilesForClient, getFileDTO, deleteFile } from '@/lib/dal/files'
import { prisma } from '@/lib/db'

beforeEach(async () => {
  await truncateAll()
})
afterEach(() => signOut())

async function seedFile(clientId: string, uploadedById: string) {
  return prisma.file.create({
    data: {
      clientId,
      uploadedById,
      storageKey: `clients/${clientId}/abc.pdf`,
      originalName: 'abc.pdf',
      mimeType: 'application/pdf',
      size: BigInt(1234),
      checksum: 'deadbeef',
    },
    select: { id: true },
  })
}

describe('listFilesForClient', () => {
  it('shows files to the owning client', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    await seedFile(c.client.id, tm.user.id)

    await signInAs(c.user)
    const res = await listFilesForClient(c.client.id)
    expect(res.items).toHaveLength(1)
    expect(res.items[0].originalName).toBe('abc.pdf')
  })

  it('blocks a different client from listing another client’s files', async () => {
    const a = await makeClient()
    const b = await makeClient()
    await seedFile(a.client.id, a.user.id)

    await signInAs(b.user)
    await expect(listFilesForClient(a.client.id)).rejects.toThrow()
  })
})

describe('getFileDTO', () => {
  it('blocks cross-client access', async () => {
    const a = await makeClient()
    const b = await makeClient()
    const f = await seedFile(a.client.id, a.user.id)

    await signInAs(b.user)
    await expect(getFileDTO(f.id)).rejects.toThrow()
  })
})

describe('deleteFile RBAC', () => {
  it('allows the uploader to delete', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    const f = await seedFile(c.client.id, tm.user.id)

    await signInAs(tm.user)
    await deleteFile(f.id)
    const row = await prisma.file.findUnique({ where: { id: f.id } })
    expect(row?.deletedAt).not.toBeNull()
  })

  it('allows SUPER_ADMIN to delete anything', async () => {
    const c = await makeClient()
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    const f = await seedFile(c.client.id, c.user.id)
    await signInAs(admin)
    await deleteFile(f.id)
    expect((await prisma.file.findUnique({ where: { id: f.id } }))?.deletedAt).not.toBeNull()
  })

  it('blocks a client from deleting a file they did not upload', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    const f = await seedFile(c.client.id, tm.user.id) // uploaded by team

    await signInAs(c.user) // owns the client, but isn't the uploader
    await expect(deleteFile(f.id)).rejects.toThrow(/Not allowed/)
  })
})
