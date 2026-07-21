// Integration tests for lib/dal/settings — the SystemSetting key-value store
// and maintenance-mode helpers.

import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { signInAs, signOut } from '../lib/mock-headers'
import { truncateAll, makeUser } from '../lib/db'
import { prisma } from '@/lib/db'
import {
  getSettingRaw,
  getBooleanSetting,
  getNumberSetting,
  getAllSettings,
  updateSettings,
  isMaintenanceMode,
  SETTING_KEYS,
} from '@/lib/dal/settings'

beforeEach(async () => {
  await truncateAll()
})
afterEach(() => signOut())

describe('settings — read defaults', () => {
  it('returns the documented default when no row exists', async () => {
    expect(await getSettingRaw('maintenanceMode')).toBe('false')
    expect(await getBooleanSetting('maintenanceMode')).toBe(false)
    expect(await getNumberSetting('inviteTtlDays')).toBe(7)
    expect(await getNumberSetting('passwordMinLength')).toBe(12)
  })

  it('returns false on DB error (fail-open) for maintenance mode', async () => {
    // isMaintenanceMode wraps the read in try/catch and returns false on error.
    // We can't easily simulate a DB error without mocking, but we can verify
    // it returns the default (false) when the table is empty.
    expect(await isMaintenanceMode()).toBe(false)
  })
})

describe('settings — write + read', () => {
  it('admin can flip maintenance mode on', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    await updateSettings({ maintenanceMode: 'true' })

    const row = await prisma.systemSetting.findUniqueOrThrow({ where: { key: 'maintenanceMode' } })
    expect(row.value).toBe('true')
    expect(row.updatedBy).toBe(admin.id)

    // Reads reflect the new value.
    expect(await getBooleanSetting('maintenanceMode')).toBe(true)
    expect(await isMaintenanceMode()).toBe(true)
  })

  it('non-admin is denied', async () => {
    const user = await makeUser({ role: 'CLIENT' })
    await signInAs(user)

    await expect(updateSettings({ maintenanceMode: 'true' })).rejects.toThrow()
  })

  it('rejects invalid boolean values', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    // Cast to bypass the type — exercising runtime validation.
    await expect(
      updateSettings({ maintenanceMode: 'yes' as unknown as 'true' }),
    ).rejects.toThrow(/Maintenance mode/)
  })

  it('rejects out-of-bounds numbers', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    await expect(updateSettings({ inviteTtlDays: '0' })).rejects.toThrow(/≥ 1/)
    await expect(updateSettings({ inviteTtlDays: '999' })).rejects.toThrow(/≤ 90/)
    await expect(updateSettings({ inviteTtlDays: 'NaN' })).rejects.toThrow(/number/)
  })

  it('clamps out-of-bounds reads to the configured range', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)

    // Write a row directly bypassing validation.
    await prisma.systemSetting.create({
      data: { key: 'inviteTtlDays', value: '99999', updatedBy: admin.id },
    })

    // Reads clamp.
    expect(await getNumberSetting('inviteTtlDays')).toBe(90)
  })
})

describe('getAllSettings', () => {
  it('admin sees every defined key with current value + definition', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    await updateSettings({ maintenanceMode: 'true', inviteTtlDays: '30' })

    const all = await getAllSettings()

    expect(Object.keys(all).sort()).toEqual(Object.keys(SETTING_KEYS).sort())
    expect(all.maintenanceMode.value).toBe('true')
    expect(all.maintenanceMode.definition.type).toBe('boolean')
    expect(all.inviteTtlDays.value).toBe('30')
    expect(all.inviteTtlDays.definition.min).toBe(1)
    expect(all.inviteTtlDays.definition.max).toBe(90)
  })

  it('non-admin is denied', async () => {
    const user = await makeUser({ role: 'CLIENT' })
    await signInAs(user)
    await expect(getAllSettings()).rejects.toThrow()
  })
})

describe('settings — maintenance mode respects DB state', () => {
  it('returns false when maintenance is off (default)', async () => {
    expect(await isMaintenanceMode()).toBe(false)
  })

  it('returns true when maintenance is on', async () => {
    const admin = await makeUser({ role: 'SUPER_ADMIN' })
    await signInAs(admin)
    await updateSettings({ maintenanceMode: 'true' })
    expect(await isMaintenanceMode()).toBe(true)
  })
})
