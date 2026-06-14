// Data Access Layer — the security boundary.
//
// Every Prisma call from Server Components, Server Actions, and Route Handlers
// must go through functions in lib/dal/*. These functions enforce authentication
// (who is the user?) and authorization (are they allowed to do this?).
//
// See docs/03-rbac-and-data-isolation.md for the full model.
//
// REVIEW fixes baked in:
//   - REVIEW.md §3.1: requireClientAccess for TEAM_MEMBER uses the resolved
//     teamMember.id (NOT user.id) for the assignment lookup. No dead code.
//   - REVIEW.md §3.3: getCurrentUser rejects tokens whose `ver` claim doesn't
//     match User.tokenVersion. Role changes / force-logout take effect
//     immediately, not on next token expiry.

import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { unauthorized, forbidden } from 'next/navigation'
import { verifyAccessToken, type AccessClaims } from '@/lib/auth/tokens'
import { prisma } from '@/lib/db'
import type { UserRole } from '@prisma/client'

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>

/**
 * Reads the JWT from the cookie and returns its claims, or null.
 * Pure crypto — no DB lookup. Memoized per request via React cache().
 *
 * Use this for cheap optimistic checks (e.g. proxy redirects, role-gated UI).
 * For security-critical decisions use getCurrentUser() / requireSession(),
 * which also verify tokenVersion against the DB.
 */
export const getSession = cache(async (): Promise<AccessClaims | null> => {
  const cs = await cookies()
  const token = cs.get('access_token')?.value
  const result = await verifyAccessToken(token)
  if (!result.ok) return null
  return result.claims
})

/**
 * Returns the authenticated user with DB-backed validation.
 *
 * Rejects (returns null) when:
 *   - There is no session.
 *   - The user no longer exists.
 *   - The token's `ver` doesn't match User.tokenVersion (role changed, force-logout).
 *
 * Memoized per request.
 */
export const getCurrentUser = cache(async () => {
  const claims = await getSession()
  if (!claims) return null

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      tokenVersion: true,
      client: { select: { id: true, uniqueSlug: true } },
      teamMember: { select: { id: true } },
    },
  })

  if (!user) return null
  if (user.tokenVersion !== claims.ver) return null

  return user
})

/**
 * Throws `unauthorized()` (renders app/unauthorized.tsx) if not authenticated.
 * Returns the current user otherwise.
 */
export async function requireSession() {
  const user = await getCurrentUser()
  if (!user) unauthorized()
  return user as NonNullable<typeof user>
}

/**
 * Throws `unauthorized()` / `forbidden()` based on auth state and role.
 * Returns the current user if their role is in `roles`.
 */
export async function requireRole<T extends UserRole>(
  ...roles: readonly T[]
) {
  const user = await requireSession()
  if (!roles.includes(user.role as T)) forbidden()
  return user
}

/**
 * Ensures the current user can access the given client.
 *
 *   - SUPER_ADMIN: always allowed
 *   - CLIENT:      only their own client
 *   - TEAM_MEMBER: only clients they're assigned to via TeamAssignment
 *
 * REVIEW.md §3.1: uses the resolved teamMember.id for the composite-key lookup.
 * The earlier draft incorrectly used userId as teamMemberId in a dead first
 * query — that bug is gone here.
 */
export async function requireClientAccess(clientId: string) {
  const user = await requireSession()

  if (user.role === 'SUPER_ADMIN') return user

  if (user.role === 'CLIENT') {
    if (!user.client || user.client.id !== clientId) forbidden()
    return user
  }

  if (user.role === 'TEAM_MEMBER') {
    if (!user.teamMember) forbidden()
    const assigned = await prisma.teamAssignment.findUnique({
      where: {
        teamMemberId_clientId: {
          teamMemberId: user.teamMember!.id,
          clientId,
        },
      },
    })
    if (!assigned) forbidden()
    return user
  }

  forbidden()
}

/**
 * Client-scoped variant of requireClientAccess that takes a slug (from URL)
 * and resolves to the clientId. Used by layouts that key off /dashboard/visitor/[slug].
 *
 * Throws NotFoundError if no client has the slug, ForbiddenError if the user
 * can't access that client. (Next's forbidden() / notFound() also throw, so
 * callers don't need to handle these specifically.)
 */
export async function requireClientAccessBySlug(slug: string) {
  const client = await prisma.client.findUnique({
    where: { uniqueSlug: slug },
    select: { id: true },
  })
  if (!client) {
    // notFound() throws and renders app/not-found.tsx; same family as forbidden().
    const { notFound } = await import('next/navigation')
    notFound()
  }
  await requireClientAccess(client!.id)
  return client!.id
}
