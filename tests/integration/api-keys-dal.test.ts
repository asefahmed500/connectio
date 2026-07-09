import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { truncateAll, makeUser } from '../lib/db'
import { signInAs, signOut } from '../lib/mock-headers'
import { prisma } from '@/lib/db'
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
} from '@/lib/dal/api-keys'
import { createHash } from 'crypto'

describe('API keys CRUD', () => {
  beforeEach(async () => { await truncateAll() })
  afterEach(async () => { await signOut() })

  it('creates and lists keys', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const { id, key, prefix } = await createApiKey(
      'My Integration',
      ['read:submissions', 'read:clients'],
      [],
      u.id,
    )
    expect(id).toBeTruthy()
    expect(key).toHaveLength(64)
    expect(prefix).toHaveLength(8)

    const keys = await listApiKeys()
    expect(keys).toHaveLength(1)
    expect(keys[0]!.name).toBe('My Integration')
    expect(keys[0]!.prefix).toBe(prefix)
    expect(keys[0]!.isActive).toBe(true)
    expect(keys[0]!.permissions).toEqual(['read:submissions', 'read:clients'])

    // Verify the key is hashed in DB, never stored raw
    const row = await prisma.apiKey.findUniqueOrThrow({ where: { id } })
    const expectedHash = createHash('sha256').update(key).digest('hex')
    expect(row.keyHash).toBe(expectedHash)
    expect(row.keyHash).not.toBe(key)
  })

  it('revokes a key', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const { id } = await createApiKey('To revoke', ['read:*'], [], u.id)
    await revokeApiKey(id, u.id)

    const keys = await listApiKeys()
    expect(keys[0]!.isActive).toBe(false)
  })

  it('defaults to read:* permission when none provided', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const { id } = await createApiKey('Default perms', [], [], u.id)
    const keys = await listApiKeys()
    expect(keys[0]!.permissions).toEqual(['read:*'])
  })

  it('blocks access for non-admin roles', async () => {
    const c = await makeUser({ role: 'CLIENT' })
    await signInAs(c)
    await expect(listApiKeys()).rejects.toThrow()
  })
})
