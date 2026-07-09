import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { truncateAll, makeUser } from '../lib/db'
import { signInAs, signOut } from '../lib/mock-headers'
import {
  listSsoProviders,
  createSsoProvider,
  updateSsoProvider,
  deleteSsoProvider,
  getActiveProviders,
  listScimApiKeys,
  createScimApiKey,
  revokeScimApiKey,
} from '@/lib/dal/sso'

describe('SSO provider CRUD', () => {
  beforeEach(async () => { await truncateAll() })
  afterEach(async () => { await signOut() })

  it('lists empty when no providers exist', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)
    const providers = await listSsoProviders()
    expect(providers).toHaveLength(0)
  })

  it('creates a SAML provider', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)
    const id = await createSsoProvider({
      name: 'Test SAML IdP',
      providerType: 'saml',
      spEntityId: 'urn:test:sp',
      idpEntityId: 'urn:test:idp',
      idpSsoUrl: 'https://idp.example.com/sso',
      idpCertificate: 'MOCK-CERTIFICATE-DATA',
    })
    expect(id).toBeTruthy()

    const providers = await listSsoProviders()
    expect(providers).toHaveLength(1)
    expect(providers[0]!.name).toBe('Test SAML IdP')
    expect(providers[0]!.providerType).toBe('saml')
  })

  it('creates an OIDC provider', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)
    const id = await createSsoProvider({
      name: 'Test OIDC',
      providerType: 'oidc',
      oidcIssuer: 'https://accounts.google.com',
      oidcDiscoveryUrl: 'https://accounts.google.com/.well-known/openid-configuration',
      oidcClientId: 'test-client-id',
      oidcClientSecret: 'test-secret',
    })
    expect(id).toBeTruthy()

    const providers = await listSsoProviders()
    expect(providers[0]!.providerType).toBe('oidc')
  })

  it('updates a provider', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)
    const id = await createSsoProvider({
      name: 'Original',
      providerType: 'saml',
    })
    await updateSsoProvider(id, {
      name: 'Updated Name',
      isActive: false,
      spEntityId: 'urn:updated:sp',
    })
    const providers = await listSsoProviders()
    expect(providers[0]!.name).toBe('Updated Name')
    expect(providers[0]!.isActive).toBe(false)
  })

  it('deletes a provider with no linked users', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)
    const id = await createSsoProvider({ name: 'ToDelete', providerType: 'saml' })
    await deleteSsoProvider(id)
    const providers = await listSsoProviders()
    expect(providers).toHaveLength(0)
  })

  it('blocks access for non-SUPER_ADMIN roles', async () => {
    const c = await makeUser({ role: 'CLIENT' })
    await signInAs(c)
    await expect(listSsoProviders()).rejects.toThrow()
  })
})

describe('getActiveProviders', () => {
  it('returns only active providers (public — no auth required)', async () => {
    await truncateAll()
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)

    await createSsoProvider({ name: 'Active SAML', providerType: 'saml', isActive: true })
    await createSsoProvider({ name: 'Inactive SAML', providerType: 'saml', isActive: false })

    await signOut()

    const active = await getActiveProviders()
    expect(active).toHaveLength(1)
    expect(active[0]!.name).toBe('Active SAML')
  })
})

describe('SCIM API keys', () => {
  beforeEach(async () => { await truncateAll() })
  afterEach(async () => { await signOut() })

  it('creates and lists SCIM keys', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)
    const { id, key, prefix } = await createScimApiKey('My SCIM Key')
    expect(id).toBeTruthy()
    expect(key).toBeTruthy()
    expect(key.length).toBeGreaterThan(30)
    expect(prefix).toHaveLength(8)

    const keys = await listScimApiKeys()
    expect(keys).toHaveLength(1)
    expect(keys[0]!.name).toBe('My SCIM Key')
    expect(keys[0]!.isActive).toBe(true)
    expect(keys[0]!.prefix).toBe(prefix)
  })

  it('revokes a key', async () => {
    const u = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(u)
    const { id } = await createScimApiKey('To revoke')
    await revokeScimApiKey(id)
    const keys = await listScimApiKeys()
    expect(keys[0]!.isActive).toBe(false)
  })
})
