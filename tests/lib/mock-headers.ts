// Helpers to act as a specific user in integration tests. The `next/headers`
// mock (registered globally in tests/setup.ts) reads the current token from
// globalThis, so these helpers just mint a real access token and stash it.
//
// The full verifyAccessToken → getCurrentUser → tokenVersion check → RBAC path
// then runs exactly as in production.

import { signAccessToken } from '@/lib/auth/tokens'
import type { UserRole } from '@prisma/client'

const TOKEN_KEY = '__ccTestToken' as const

export async function signInAs(opts: {
  id: string
  role: UserRole
  tokenVersion: number
  clientId?: string
}): Promise<void> {
  const token = await signAccessToken({
    sub: opts.id,
    role: opts.role,
    tokenVersion: opts.tokenVersion,
    clientId: opts.clientId,
  })
  ;(globalThis as unknown as Record<string, string | undefined>)[TOKEN_KEY] = token
}

export function signOut(): void {
  ;(globalThis as unknown as Record<string, string | undefined>)[TOKEN_KEY] = undefined
}
