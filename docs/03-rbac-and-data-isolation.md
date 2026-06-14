# 03 — RBAC & Data Isolation

**Status:** Draft
**Roles:** `SUPER_ADMIN`, `TEAM_MEMBER`, `CLIENT`

Roles live on `User.role` (single value per user) and are also embedded in the access token. A user has exactly one role; a client or team-member profile row is created alongside the user if applicable.

## Permission matrix

| Capability | SUPER_ADMIN | TEAM_MEMBER | CLIENT |
|------------|:---:|:---:|:---:|
| Generate invite link | ✓ | — | — |
| Revoke invite | ✓ | — | — |
| List all clients | ✓ | — | — |
| View any client | ✓ | — | — |
| View assigned clients only | ✓ | ✓ | — |
| Update client metadata | ✓ | ✓ (assigned) | — (profile fields only, own) |
| Create/edit Forms | ✓ | — | — |
| Read Forms | ✓ | ✓ (assigned) | ✓ (active only) |
| Submit Form | — | — | ✓ (own) |
| Update Submission status | ✓ | ✓ (assigned) | — |
| Upload file to own submission | — | — | ✓ |
| Upload file to assigned client's submission | ✓ | ✓ | — |
| Delete file | ✓ | ✓ (own client) | ✓ (own uploads) |
| Post external comment (client-visible) | ✓ | ✓ (assigned) | ✓ (own client) |
| Post internal comment (client-hidden) | ✓ | ✓ (assigned) | — |
| Read internal comments | ✓ | ✓ (assigned) | — |
| Manage team members | ✓ | — | — |
| View global analytics | ✓ | — | — |
| View own dashboard | ✓ | ✓ | ✓ |
| Export client data | ✓ | — | — |
| Manage system settings | ✓ | — | — |

"Assigned" means there's a `TeamAssignment` row linking the team member to the client.

## Enforcement layers

There are three places where role/ownership is checked. **All three are required.** Removing any one creates a vulnerability.

```
Browser → proxy.ts → Server Component / Action → DAL (final gate)
         (optimistic)   (UI gating)               (authoritative)
```

1. **`proxy.ts`** — optimistic redirect only. Reads the cookie, redirects to `/login` if no session, but **does not** do DB checks. Used to bounce unauthenticated users from `/admin/*` before rendering.
2. **Server Component / Server Action** — calls into the DAL. May render different UI based on role (e.g. hide the "Generate Invite" button from team members). UI gating is convenience, not security.
3. **DAL** — the authoritative check. Every read/write goes through a DAL function that calls `verifySession()`, then `requireRole()` or `requireClientAccess()` before touching the DB. **If a function in the DAL doesn't auth-check, it's a bug.**

## The Data Access Layer

`lib/dal/*` is the only place that imports `prisma`. Server Components, Server Actions, and Route Handlers call DAL functions; they never call `prisma` directly.

```ts
// lib/dal/session.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { unauthorized, forbidden } from 'next/navigation'
import { verifyAccessToken, type AccessClaims } from '@/lib/auth/tokens'
import { prisma } from '@/lib/db'

export type SessionUser = {
  userId: string
  role: UserRole
  clientId: string | null
}

/**
 * Returns the authenticated user or null. Memoized per-request via cache().
 * Safe to call from any server code; reads cookie → verifies JWT → returns claims.
 * Does NOT touch the DB. For DB-backed session checks, use getCurrentUser().
 */
export const getSession = cache(async (): Promise<AccessClaims | null> => {
  const cs = await cookies()
  const token = cs.get('access_token')?.value
  return verifyAccessToken(token)
})

/**
 * Returns the full user record. DB-backed. Memoized per-request.
 */
export const getCurrentUser = cache(async () => {
  const claims = await getSession()
  if (!claims) return null
  return prisma.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, name: true, role: true, client: true, teamMember: true },
  })
})

/**
 * Throws `unauthorized()` if no session. Returns the claims.
 * Use at the top of any DAL function that requires login.
 */
export async function requireSession(): Promise<AccessClaims> {
  const claims = await getSession()
  if (!claims) unauthorized()
  return claims
}

/**
 * Throws `forbidden()` if the user's role isn't in the allow-list.
 */
export async function requireRole(...roles: UserRole[]): Promise<AccessClaims> {
  const claims = await requireSession()
  if (!roles.includes(claims.role)) forbidden()
  return claims
}

/**
 * Ensures the current user can access the given client.
 * - SUPER_ADMIN: always
 * - TEAM_MEMBER: must have TeamAssignment
 * - CLIENT: must be this client (clientId from session)
 */
export async function requireClientAccess(clientId: string): Promise<AccessClaims> {
  const claims = await requireSession()

  if (claims.role === 'SUPER_ADMIN') return claims

  if (claims.role === 'CLIENT') {
    if (claims.clientId !== clientId) forbidden()
    return claims
  }

  if (claims.role === 'TEAM_MEMBER') {
    const assigned = await prisma.teamAssignment.findUnique({
      where: {
        teamMemberId_clientId: {
          teamMemberId: claims.sub,  // NOTE: claims.sub is userId; lookup teamMember by userId first
          clientId,
        },
      },
    }).catch(() => null)
    // The composite key expects teamMemberId; resolve it:
    const teamMember = await prisma.teamMember.findUnique({ where: { userId: claims.sub } })
    if (!teamMember) forbidden()
    const ok = await prisma.teamAssignment.findUnique({
      where: { teamMemberId_clientId: { teamMemberId: teamMember!.id, clientId } },
    })
    if (!ok) forbidden()
    return claims
  }

  forbidden()
}
```

## DAL resource functions

Every resource getter follows the same shape: take an ID, call a `require*` guard, run the query, map to a DTO.

```ts
// lib/dal/clients.ts
import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireRole, requireClientAccess, getCurrentUser } from '@/lib/dal/session'
import { writeAudit } from '@/lib/audit'

export type ClientDTO = {
  id: string
  companyName: string
  contactName: string
  uniqueSlug: string
  projectBrief: string | null
  budget: string | null
  timeline: string | null
  submissionsCount: number
  lastActivityAt: Date | null
}

export const getClientDTO = cache(async (clientId: string): Promise<ClientDTO> => {
  await requireClientAccess(clientId)
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    include: {
      _count: { select: { submissions: true } },
      submissions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
    },
  })

  return {
    id: client.id,
    companyName: client.companyName,
    contactName: client.contactName,
    uniqueSlug: client.uniqueSlug,
    projectBrief: client.projectBrief,
    budget: client.budget,
    timeline: client.timeline,
    submissionsCount: client._count.submissions,
    lastActivityAt: client.submissions[0]?.updatedAt ?? null,
  }
})

export async function listAllClients(): Promise<ClientDTO[]> {
  await requireRole('SUPER_ADMIN')
  // ... prisma query, map to DTOs
}

export async function listMyAssignedClients(): Promise<ClientDTO[]> {
  const claims = await requireRole('TEAM_MEMBER')
  // ... prisma query filtered by team assignment
}
```

## Multi-tenant isolation rules

This is a **shared-schema multi-tenant** app: all clients live in the same database, isolated by `clientId`. The rules below are non-negotiable.

1. **Every tenant-scoped query has `clientId` in its `where` clause.** No exceptions. Code review enforces this.
2. **`clientId` comes from the session, never from request input.** The URL may carry it (e.g. `/admin/clients/<id>`), but the DAL re-derives the *accessible* clientId from the session via `requireClientAccess(urlClientId)`.
3. **No `findMany` without a `where`.** A bare `findMany` returns every row in the table — almost always a leak. Lint rule planned.
4. **Admin endpoints that bypass `clientId` filtering live in their own file** (`lib/dal/admin.ts`) and every function starts with `requireRole('SUPER_ADMIN')`.
5. **Soft deletes are explicit.** No global "deletedAt" column. If a client is deleted, the cascade policy (`01-data-model.md`) applies; we don't keep zombie rows.

## IDOR prevention

Insecure Direct Object Reference is the #1 risk in this kind of app. Defenses:

- **Every get-by-id call goes through the DAL**, which calls `requireClientAccess(id)` before returning data. Example: `GET /api/comments?clientId=abc` — the route handler calls `getCommentsDTO(clientId)`, which calls `requireClientAccess(clientId)`. If the caller isn't authorized, `forbidden()` throws before any data leaves the DB.
- **Slugs are not secrets.** `/dashboard/visitor/<slug>` works only because the user has an authenticated session for *that client*. A logged-in client A cannot access `/dashboard/visitor/<slug-B>` — the proxy doesn't catch this; the DAL does.
- **Sequential IDs are never exposed.** All external IDs are cuid (random-looking strings).
- **Audit log writes for every privileged read.** Viewing another client's data leaves a trail.

## Internal vs external comments

`Comment.isInternal` controls visibility:

- `CLIENT` role never sees comments where `isInternal = true`. Enforced in `getCommentsDTO` (DAL filters by viewer role).
- `TEAM_MEMBER` and `SUPER_ADMIN` see both.
- Default value when posting: depends on author role and route — see `06-comments.md`.

## What role checks don't protect

- **`proxy.ts` cannot be the only check.** It runs on every request including prefetches; doing DB work there tanks performance. Use it for redirects only.
- **Client Components.** Anything that runs in the browser can be modified by the user. Hide UI for ergonomics, never for security.
- **Layouts.** Per Next 16 docs, layouts don't re-render on navigation. A `requireRole()` call in a layout runs once per session — too coarse. Do it in the page/DAL.

## Server Action rules

Server Actions are publicly reachable POST endpoints (the Next 16 docs are explicit about this). Each one must:

1. Call into the DAL (which auth-checks).
2. Validate input with Zod.
3. Return a minimal DTO — never a raw Prisma row.
4. Use `revalidatePath()` / `revalidateTag()` to bust caches.
5. Call `redirect()` outside any `try/catch` (or use `unstable_rethrow()`).

```ts
// app/(admin)/clients/[id]/actions.ts
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { updateClientBudget } from '@/lib/dal/clients'

const Schema = z.object({
  clientId: z.string().cuid(),
  budget: z.string().max(200),
})

export async function updateBudgetAction(formData: FormData) {
  const parsed = Schema.safeParse({
    clientId: formData.get('clientId'),
    budget: formData.get('budget'),
  })
  if (!parsed.success) return { error: 'Invalid input' }

  // DAL will requireRole or requireClientAccess depending on policy.
  await updateClientBudget(parsed.data.clientId, parsed.data.budget)
  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
  return { success: true }
}
```

## Audit hook

Every privileged operation calls `writeAudit(action, userId, resource, resourceId, changes?)`. Implemented via `after()` so it doesn't block the response — see `11-error-handling-and-observability.md`.
