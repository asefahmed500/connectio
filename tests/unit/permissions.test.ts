import { describe, expect, it } from 'vitest'
import {
  PERMISSIONS,
  getPermissionsForRole,
  getPermissionsByDomain,
} from '@/lib/auth/permissions'

describe('PERMISSIONS', () => {
  it('defines at least 40 unique permissions', () => {
    expect(Object.keys(PERMISSIONS).length).toBeGreaterThanOrEqual(40)
  })

  it('every permission has a description string', () => {
    for (const [key, desc] of Object.entries(PERMISSIONS)) {
      expect(typeof desc).toBe('string')
      expect(desc.length).toBeGreaterThan(0)
    }
  })

  it('follows the domain:action naming convention', () => {
    for (const key of Object.keys(PERMISSIONS)) {
      expect(key).toMatch(/^\w+:\S+$/)
    }
  })
})

describe('getPermissionsForRole', () => {
  it('SUPER_ADMIN has all admin-level permissions (excludes client-only sso:use and invite:use)', () => {
    const perms = getPermissionsForRole('SUPER_ADMIN')
    // SUPER_ADMIN intentionally excludes 'sso:use' and 'invite:use' which are client-team permissions
    const allKeys = Object.keys(PERMISSIONS)
    const excluded = allKeys.filter((k) => !perms.includes(k as keyof typeof PERMISSIONS))
    expect(excluded.sort()).toEqual(['invite:use', 'sso:use'].sort())
  })

  it('TEAM_MEMBER has some but not all permissions', () => {
    const perms = getPermissionsForRole('TEAM_MEMBER')
    expect(perms.length).toBeGreaterThan(10)
    expect(perms.length).toBeLessThan(Object.keys(PERMISSIONS).length)
  })

  it('TEAM_MEMBER has profile and team read but not admin gdpr', () => {
    const perms = getPermissionsForRole('TEAM_MEMBER')
    expect(perms).toContain('profile:update')
    expect(perms).toContain('team:read')
    expect(perms).not.toContain('gdpr:manage')
    expect(perms).not.toContain('sso:manage')
  })

  it('CLIENT has limited permissions', () => {
    const perms = getPermissionsForRole('CLIENT')
    expect(perms.length).toBeGreaterThan(5)
    expect(perms.length).toBeLessThan(20)
    expect(perms).toContain('submission:create')
    expect(perms).toContain('profile:read')
    expect(perms).not.toContain('user:delete')
  })

  it('TEAM_MEMBER cannot manage users', () => {
    const perms = getPermissionsForRole('TEAM_MEMBER')
    expect(perms).not.toContain('user:create')
    expect(perms).not.toContain('user:delete')
  })
})

describe('getPermissionsByDomain', () => {
  it('groups permissions by their domain prefix', () => {
    const domains = getPermissionsByDomain()
    expect(domains.user).toBeDefined()
    expect(domains.client).toBeDefined()
    expect(domains.form).toBeDefined()
    expect(domains.submission).toBeDefined()
  })

  it('every permission belongs to exactly one domain', () => {
    const domains = getPermissionsByDomain()
    let total = 0
    for (const perms of Object.values(domains)) {
      total += perms.length
    }
    expect(total).toBe(Object.keys(PERMISSIONS).length)
  })
})
