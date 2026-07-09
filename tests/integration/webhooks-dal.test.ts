import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { truncateAll, makeUser } from '../lib/db'
import { signInAs, signOut } from '../lib/mock-headers'
import { prisma } from '@/lib/db'
import {
  listWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  getWebhook,
} from '@/lib/dal/webhooks'

describe('webhook CRUD', () => {
  beforeEach(async () => { await truncateAll() })
  afterEach(async () => { await signOut() })

  it('creates and lists webhooks', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const id = await createWebhook({
      name: 'Test Webhook',
      url: 'https://example.com/hook',
      events: ['audit'],
      createdBy: u.id,
    })
    expect(id).toBeTruthy()

    const webhooks = await listWebhooks()
    expect(webhooks).toHaveLength(1)
    expect(webhooks[0]!.name).toBe('Test Webhook')
    expect(webhooks[0]!.url).toBe('https://example.com/hook')
    expect(webhooks[0]!.events).toEqual(['audit'])
    expect(webhooks[0]!.isActive).toBe(true)
    expect(webhooks[0]!.secret).toBeTruthy()
  })

  it('creates with wildcard events', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    await createWebhook({
      name: 'All events',
      url: 'https://example.com/all',
      events: ['*'],
      createdBy: u.id,
    })

    const webhooks = await listWebhooks()
    expect(webhooks[0]!.events).toEqual(['*'])
  })

  it('updates a webhook', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const id = await createWebhook({
      name: 'Original',
      url: 'https://example.com/1',
      events: ['audit'],
      createdBy: u.id,
    })

    await updateWebhook(id, {
      name: 'Updated',
      isActive: false,
      events: ['notification'],
      timeoutSec: 30,
      retryCount: 5,
    })

    const wh = await getWebhook(id)
    expect(wh.name).toBe('Updated')
    expect(wh.isActive).toBe(false)
    expect(wh.events).toEqual(['notification'])
    expect(wh.timeoutSec).toBe(30)
    expect(wh.retryCount).toBe(5)
  })

  it('rotates the secret', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const id = await createWebhook({
      name: 'Secret test',
      url: 'https://example.com/s',
      events: ['audit'],
      createdBy: u.id,
    })

    const original = await getWebhook(id)
    const newSecret = await rotateWebhookSecret(id)
    expect(newSecret).not.toBe(original.secret)

    const updated = await getWebhook(id)
    expect(updated.secret).toBe(newSecret)
  })

  it('deletes a webhook', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    const id = await createWebhook({
      name: 'To delete',
      url: 'https://example.com/d',
      events: ['audit'],
      createdBy: u.id,
    })

    await deleteWebhook(id)
    await expect(getWebhook(id)).rejects.toThrow()
  })

  it('blocks access for non-admin roles', async () => {
    const c = await makeUser({ role: 'CLIENT' })
    await signInAs(c)
    await expect(listWebhooks()).rejects.toThrow()
  })
})
