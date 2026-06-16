// Integration tests for lib/dal/comments — 2-level threading, internal-comment
// visibility (the security boundary), and delete RBAC.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeClient, makeTeamMember, makeUser, assignTeam } from '../lib/db'
import { getCommentsDTO, postComment, deleteComment } from '@/lib/dal/comments'
import { prisma } from '@/lib/db'

beforeEach(async () => {
  await truncateAll()
})
afterEach(() => signOut())

describe('internal-comment visibility', () => {
  it('hides internal comments from the CLIENT but shows them to team/admin', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)

    // Team member posts an internal note.
    await signInAs(tm.user)
    await postComment({ clientId: c.client.id, message: 'secret internal note', isInternal: true })

    // Admin sees it.
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    const adminView = await getCommentsDTO({ clientId: c.client.id })
    expect(adminView).toHaveLength(1)
    expect(adminView[0].isInternal).toBe(true)

    // Client does NOT see it.
    await signInAs(c.user)
    const clientView = await getCommentsDTO({ clientId: c.client.id })
    expect(clientView).toHaveLength(0)
  })

  it('strips the internal flag when a CLIENT tries to post one', async () => {
    const c = await makeClient()
    await signInAs(c.user)
    const { id } = await postComment({
      clientId: c.client.id,
      message: 'trying to be internal',
      isInternal: true,
    })
    const row = await prisma.comment.findUnique({ where: { id } })
    expect(row?.isInternal).toBe(false)
  })
})

describe('threading depth', () => {
  it('allows one reply level but rejects a reply to a reply', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    await signInAs(tm.user)

    const top = await postComment({ clientId: c.client.id, message: 'top level' })
    const reply = await postComment({
      clientId: c.client.id,
      parentId: top.id,
      message: 'first reply',
    })
    expect(reply.id).toBeTruthy()

    // Replying to a reply would create a 3rd level — must throw.
    await expect(
      postComment({ clientId: c.client.id, parentId: reply.id, message: 'second reply' }),
    ).rejects.toThrow(/max depth/)
  })

  it('builds a 2-level tree in getCommentsDTO', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    await signInAs(tm.user)

    const top = await postComment({ clientId: c.client.id, message: 'top' })
    await postComment({ clientId: c.client.id, parentId: top.id, message: 'reply' })

    const tree = await getCommentsDTO({ clientId: c.client.id })
    expect(tree).toHaveLength(1)
    expect(tree[0].replies).toHaveLength(1)
  })
})

describe('deleteComment RBAC', () => {
  it('lets the author delete their own comment', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    await signInAs(tm.user)
    const { id } = await postComment({ clientId: c.client.id, message: 'mine' })

    await deleteComment(id)
    const row = await prisma.comment.findUnique({ where: { id } })
    expect(row?.deletedAt).not.toBeNull() // soft delete
  })

  it('blocks a non-author from deleting', async () => {
    const c = await makeClient()
    const tm = await makeTeamMember()
    await assignTeam(tm.teamMember.id, c.client.id)
    await signInAs(tm.user)
    const { id } = await postComment({ clientId: c.client.id, message: 'team note' })

    // A different team member (also assigned) is not the author.
    const tm2 = await makeTeamMember()
    await assignTeam(tm2.teamMember.id, c.client.id)
    await signInAs(tm2.user)
    await expect(deleteComment(id)).rejects.toThrow(/Not allowed/)
  })
})
