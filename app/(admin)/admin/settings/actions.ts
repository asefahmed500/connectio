'use server'

import { revalidatePath } from 'next/cache'
import {
  updateSettings,
  SETTING_KEYS,
  type SettingKey,
} from '@/lib/dal/settings'

export type SettingsState =
  | undefined
  | { error: string }
  | { success: true }

const KEYS = Object.keys(SETTING_KEYS) as SettingKey[]

export async function saveSettingsAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  try {
    const updates: Partial<Record<SettingKey, string>> = {}

    for (const key of KEYS) {
      const def = SETTING_KEYS[key]
      const raw = formData.get(key)

      if (def.type === 'boolean') {
        // Switch submits "on" when checked, nothing when unchecked.
        updates[key] = raw === 'on' || raw === 'true' ? 'true' : 'false'
      } else if (typeof raw === 'string') {
        updates[key] = raw
      }
    }

    await updateSettings(updates)
    revalidatePath('/admin/settings')
    return { success: true }
  } catch (err) {
    console.error('[settings] save failed:', err)
    return { error: 'Could not save settings. Check the logs.' }
  }
}
