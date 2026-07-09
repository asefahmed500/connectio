'use server'

import { revalidatePath } from 'next/cache'
import {
  beginTwoFactorEnrollment,
  completeTwoFactorEnrollment,
  disableTwoFactor,
} from '@/lib/dal/two-factor'
import { totpToDataUrl } from '@/lib/auth/totp'

export async function startEnrollmentAction(): Promise<{ secret: string; uri: string; qr: string } | { error: string }> {
  try {
    const { secret, uri } = await beginTwoFactorEnrollment()
    const qr = await totpToDataUrl(uri)
    return { secret, uri, qr }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to start setup' }
  }
}

export async function confirmEnrollmentAction(code: string): Promise<{ backupCodes: string[] } | { error: string }> {
  try {
    const result = await completeTwoFactorEnrollment(code)
    return result
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to confirm' }
  }
}

export async function disableEnrollmentAction(): Promise<{ ok: true } | { error: string }> {
  try {
    await disableTwoFactor(true)
    return { ok: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to disable' }
  }
}

export async function revalidateProfile(slug: string) {
  revalidatePath(`/dashboard/visitor/${slug}/profile`)
}
