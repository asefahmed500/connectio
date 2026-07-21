import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { getCurrentUser } from '@/lib/dal/session'
import { cache } from 'react'

// Runtime-configurable system settings. Persisted in the SystemSetting table
// (key-value). Reads are cached per-request via React cache().
//
// To add a new setting:
//   1. Add a key to SETTING_KEYS below with its default + parser.
//   2. The settings form will auto-render a control for it.
//   3. Use `getSetting('yourKey')` from any DAL/route/action.

export const SETTING_KEYS: Record<string, SettingDefinition> = {
  maintenanceMode: {
    label: 'Maintenance mode',
    description: 'Block client portal access. Admins can still sign in.',
    type: 'boolean',
    default: 'false',
  },
  maintenanceMessage: {
    label: 'Maintenance message',
    description: 'Message shown to clients when maintenance mode is on.',
    type: 'text',
    default: 'We are performing scheduled maintenance. Please check back shortly.',
  },
  inviteTtlDays: {
    label: 'Invite link TTL (days)',
    description: 'How long client invite links remain valid after creation.',
    type: 'number',
    default: '7',
    min: 1,
    max: 90,
  },
  passwordMinLength: {
    label: 'Minimum password length',
    description: 'Enforced at registration and password change.',
    type: 'number',
    default: '12',
    min: 8,
    max: 128,
  },
  requireAdminTwoFactor: {
    label: 'Require 2FA for admins',
    description: 'Force SUPER_ADMIN users to enroll in 2FA before they can sign in.',
    type: 'boolean',
    default: 'false',
  },
}

export type SettingKey = keyof typeof SETTING_KEYS
export type SettingType = 'boolean' | 'text' | 'number'

export type SettingDefinition = {
  label: string
  description: string
  type: SettingType
  default: string
  min?: number
  max?: number
}

/**
 * Read a single setting as its raw string value (or the default if unset).
 * Cached per-request.
 */
export const getSettingRaw = cache(async (key: SettingKey): Promise<string> => {
  const def = SETTING_KEYS[key]
  if (!def) throw new Error(`Unknown setting: ${key}`)
  const row = await prisma.systemSetting.findUnique({ where: { key } })
  return row?.value ?? def.default
})

/** Read a boolean setting. */
export async function getBooleanSetting(key: SettingKey): Promise<boolean> {
  const raw = await getSettingRaw(key)
  return raw === 'true' || raw === '1'
}

/** Read a numeric setting (with bounds clamping). */
export async function getNumberSetting(key: SettingKey): Promise<number> {
  const def = SETTING_KEYS[key]
  const raw = await getSettingRaw(key)
  const parsed = Number(raw)
  if (Number.isNaN(parsed)) return Number(def.default)
  if (def.min !== undefined && parsed < def.min) return def.min
  if (def.max !== undefined && parsed > def.max) return def.max
  return parsed
}

/** Read all settings as a key→{value, definition} map. Used by the admin form. */
export async function getAllSettings(): Promise<
  Record<SettingKey, { value: string; definition: SettingDefinition }>
> {
  await requirePermission('settings:manage')
  const rows = await prisma.systemSetting.findMany()
  const byKey = new Map(rows.map((r) => [r.key as SettingKey, r.value]))

  const result = {} as Record<SettingKey, { value: string; definition: SettingDefinition }>
  for (const k of Object.keys(SETTING_KEYS) as SettingKey[]) {
    const definition = SETTING_KEYS[k]
    result[k] = {
      value: byKey.get(k) ?? definition.default,
      definition,
    }
  }
  return result
}

/**
 * Persist multiple settings at once. Authoritative write — used by the admin
 * settings form. Audit + notify fire outside the transaction.
 */
export async function updateSettings(
  updates: Partial<Record<SettingKey, string>>,
): Promise<void> {
  const admin = await requirePermission('settings:manage')
  const entries = Object.entries(updates) as [SettingKey, string][]

  // Validate before writing.
  for (const [key, value] of entries) {
    const def = SETTING_KEYS[key]
    if (!def) throw new Error(`Unknown setting: ${key}`)

    if (def.type === 'boolean') {
      if (value !== 'true' && value !== 'false') {
        throw new Error(`${def.label} must be 'true' or 'false'`)
      }
    } else if (def.type === 'number') {
      const n = Number(value)
      if (Number.isNaN(n)) throw new Error(`${def.label} must be a number`)
      if (def.min !== undefined && n < def.min) throw new Error(`${def.label} must be ≥ ${def.min}`)
      if (def.max !== undefined && n > def.max) throw new Error(`${def.label} must be ≤ ${def.max}`)
    } else if (def.type === 'text') {
      if (typeof value !== 'string' || value.length > 1000) {
        throw new Error(`${def.label} must be a string under 1000 chars`)
      }
    }
  }

  if (entries.length === 0) return

  // Capture pre-write values for the audit trail.
  const previousRows = await prisma.systemSetting.findMany({
    where: { key: { in: entries.map(([k]) => k) } },
    select: { key: true, value: true },
  })
  const beforeMap: Record<string, string> = {}
  for (const r of previousRows) beforeMap[r.key] = r.value
  for (const [k] of entries) {
    if (!(k in beforeMap)) beforeMap[k] = SETTING_KEYS[k].default
  }

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.systemSetting.upsert({
        where: { key },
        create: { key, value, updatedBy: admin.id },
        update: { value, updatedBy: admin.id },
      }),
    ),
  )

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'SETTINGS_UPDATED',
    userId: admin.id,
    resource: 'SystemSetting',
    resourceId: entries.map(([k]) => k).join(','),
    changes: {
      before: beforeMap,
      after: Object.fromEntries(entries),
    },
  }).catch((err: unknown) => console.error('[settings] audit failed:', err))
}

/**
 * Convenience: is maintenance mode currently on? Cached per-request, no auth
 * required (used by proxy.ts and public client routes).
 */
export async function isMaintenanceMode(): Promise<boolean> {
  try {
    return await getBooleanSetting('maintenanceMode')
  } catch {
    // DB error or table missing — fail open (don't lock everyone out).
    return false
  }
}

/**
 * Read the maintenance message. Empty if maintenance is off.
 */
export async function getMaintenanceMessage(): Promise<string> {
  return getSettingRaw('maintenanceMessage')
}

// Warm the current user for the audit log shape above (avoids unused warning).
export async function _whoAmI() {
  return getCurrentUser()
}
