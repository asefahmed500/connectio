# 08 — Routing & UI Layout

**Status:** Draft
**Router:** App Router (`app/`)
**Auth gate:** `proxy.ts` (optimistic, redirect-only)

The App Router structure encodes the three-role model directly in the URL. Route groups (`(admin)`, `(team)`, `(client)`, `(auth)`, `(public)`) organize code without affecting URLs.

## Route map

```
/                                 → public landing (or redirect to dashboard if logged in)
/login                            → (auth) login form
/invite/[slug]                    → (public) registration form keyed by invite slug
/forgot-password                  → (auth) request reset
/reset-password                   → (auth) consume reset token

/admin                            → (admin) dashboard (SUPER_ADMIN only)
/admin/clients                    → list
/admin/clients/[id]               → detail with tabs: Submissions, Comments, Files, Audit
/admin/clients/[id]/submissions/[subId]  → submission detail
/admin/forms                      → form builder list
/admin/forms/[id]                 → form builder editor
/admin/team                       → team member management
/admin/invites                    → invite management
/admin/settings                   → system settings

/team                             → (team) dashboard (TEAM_MEMBER)
/team/clients                     → list (assigned only)
/team/clients/[id]                → detail (assigned only)

/dashboard/visitor/[slug]         → (client) client dashboard (CLIENT)
/dashboard/visitor/[slug]/forms   → list of available forms
/dashboard/visitor/[slug]/submissions/[id]  → fill/edit a form
/dashboard/visitor/[slug]/files   → my uploads

/api/auth/login                   → POST (not used if action is wired)
/api/auth/logout                  → POST
/api/auth/refresh                 → POST, rotates tokens
/api/admin/*                      → route handlers for admin operations
/api/team/*                       → route handlers for team operations
/api/client/*                     → route handlers for client operations
/api/comments                     → GET, POST
/api/comments/[id]                → GET, PATCH, DELETE
/api/uploads                      → POST
/api/uploads/[id]                 → GET, DELETE
/api/webhooks/*                   → external integrations (email bounces, etc.)
/api/health                       → GET healthcheck

/unauthorized                     → 401 page (rendered by `unauthorized.tsx`)
/forbidden                        → 403 page (rendered by `forbidden.tsx`)
                                 (these are also triggered by calling unauthorized()/forbidden()
                                  — the user doesn't need to navigate to them manually)
```

## Route groups

```
app/
├── (public)/                # no auth; landing, invite pages
│   ├── page.tsx             # /
│   └── invite/[slug]/...
├── (auth)/                  # logged-out only; proxy redirects away if session
│   ├── login/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
│   └── layout.tsx           # centered card layout
├── (admin)/                 # SUPER_ADMIN only
│   ├── admin/...
│   └── layout.tsx           # sidebar + topbar; calls requireRole('SUPER_ADMIN')
├── (team)/                  # TEAM_MEMBER only
│   ├── team/...
│   └── layout.tsx           # calls requireRole('TEAM_MEMBER')
├── (client)/                # CLIENT only
│   ├── dashboard/visitor/[slug]/...
│   └── layout.tsx           # calls requireRole('CLIENT')
├── api/                     # route handlers; auth in each handler
│   └── ...
├── unauthorized.tsx         # rendered when unauthorized() is called
├── forbidden.tsx            # rendered when forbidden() is called
├── error.tsx                # top-level error boundary (client component)
├── global-error.tsx         # root layout error boundary
├── not-found.tsx            # 404
├── layout.tsx               # root layout: <html><body>; no auth check
└── page.tsx                 # / — same as (public)/page.tsx or redirects
```

> **Layouts and auth checks:** per the Next 16 docs, layouts don't re-render on navigation. Calling `requireRole()` in a route group layout is acceptable **only** because it'll re-fetch via the DAL on every navigation to a page under that group (the page itself also calls into the DAL, which re-checks). The layout's check is a UX guard; the page/DAL check is the security gate.

## `proxy.ts`

Lives at the repo root (`/proxy.ts`). Same role as `middleware.ts` in older Next.js — renamed in v16 for clarity.

```ts
// proxy.ts
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { verifyAccessToken } from '@/lib/auth/tokens'

const PROTECTED = ['/admin', '/team', '/dashboard/visitor']
const AUTH_ONLY = ['/login', '/forgot-password', '/reset-password']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Skip for static assets and API routes (API handlers do their own auth).
  if (path.startsWith('/_next') || path === '/favicon.ico') return NextResponse.next()

  const cs = await cookies()
  const claims = await verifyAccessToken(cs.get('access_token')?.value)

  const isProtected = PROTECTED.some(p => path.startsWith(p))
  const isAuthOnly = AUTH_ONLY.includes(path)

  if (isProtected && !claims) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // Role-aware redirect: a CLIENT hitting /admin goes to their dashboard.
  if (claims && isProtected) {
    const expected = claims.role === 'SUPER_ADMIN' ? '/admin'
                   : claims.role === 'TEAM_MEMBER' ? '/team'
                   : '/dashboard/visitor'
    // If the user is hitting the wrong area, redirect.
    if (!path.startsWith(expected) && claims.role === 'CLIENT' && path.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/dashboard/visitor', req.nextUrl))
    }
  }

  if (claims && isAuthOnly) {
    const dest = claims.role === 'SUPER_ADMIN' ? '/admin'
               : claims.role === 'TEAM_MEMBER' ? '/team'
               : '/dashboard/visitor'
    return NextResponse.redirect(new URL(dest, req.nextUrl))
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except static assets, API, and Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
```

**Caveats:**
- The matcher excludes `/api/*` so route handlers do their own auth (the proxy can't make fine-grained decisions cheaply).
- No DB lookups in the proxy. The cookie is verified with `verifyAccessToken()` only — that's pure JWT crypto, no I/O.
- Sliding refresh happens client-side: when a fetch returns 401, the client tries `POST /api/auth/refresh` once, then retries.

## Layouts

### Root layout (`app/layout.tsx`)

Already exists in the scaffold. Sets `<html lang>`, `<body>`, fonts, and the Geist CSS variables. **No auth check** — root layout wraps everything including login and unauthorized pages.

### `(admin)` layout

```tsx
// app/(admin)/layout.tsx
import { requireRole } from '@/lib/dal/session'
import { AdminShell } from '@/components/shells/admin-shell'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Optimistic check. The page-level DAL calls are the authoritative check.
  await requireRole('SUPER_ADMIN')
  return <AdminShell>{children}</AdminShell>
}
```

`AdminShell` is a Client Component that holds the sidebar/topbar state. It receives the current user as a plain-serializable prop (no functions, no Date objects — see the RSC-boundaries skill).

### `(client)` layout

The client area is keyed by slug in the URL (`/dashboard/visitor/[slug]`). The layout verifies that the session's `clientId` matches the slug's client:

```tsx
// app/(client)/dashboard/visitor/[slug]/layout.tsx
import { requireClientAccessBySlug } from '@/lib/dal/clients'
import { ClientShell } from '@/components/shells/client-shell'

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await requireClientAccessBySlug(slug)
  return <ClientShell slug={slug}>{children}</ClientShell>
}
```

If a client tries to view another client's slug, `requireClientAccessBySlug` calls `forbidden()` and the user lands on `app/forbidden.tsx`.

## Error pages

- `app/error.tsx` — client component, catches render errors below root layout. Shows a generic "something went wrong" with a retry button.
- `app/global-error.tsx` — client component, must render its own `<html><body>`. Catches errors in the root layout itself.
- `app/not-found.tsx` — rendered when `notFound()` is called or a route doesn't exist.
- `app/unauthorized.tsx` — rendered when `unauthorized()` is called (no session).
- `app/forbidden.tsx` — rendered when `forbidden()` is called (session but no permission).

## Server / Client component boundaries

Per the `next-best-practices/rsc-boundaries.md` skill:

- **Server Components** (default): do auth, fetch via DAL, render HTML.
- **Client Components** (`'use client'`): forms, interactive UI. Receive **plain JSON-serializable props** from server parents (no `Date`, no `Map`, no functions other than server actions).
- **Server Actions** (`'use server'`): all mutations. Re-validate auth inside.

**Gotcha:** `Date` props silently become strings when crossing into Client Components. DTOs in `lib/dal/*` return `createdAt: string` (ISO) for this reason.

## Navigation

- Use `next/link` for internal navigation. Don't use `<a>`.
- After a mutation in a Server Action, call `revalidatePath('/admin/clients/[id]')` (or `revalidateTag('clients')` for broader busting). The proxy matcher excludes `/api/*` from revalidation concerns.

## File layout under `app/`

```
app/(admin)/admin/clients/[id]/
├── page.tsx              # detail page (Server Component)
├── loading.tsx           # skeleton shown while page streams
├── error.tsx             # route-scoped error UI
├── not-found.tsx         # client not found
├── edit/page.tsx         # /admin/clients/[id]/edit
├── submissions/
│   └── [subId]/page.tsx
└── actions.ts            # Server Actions scoped to this client
```

**Colocation convention:** Server Actions for a page live in `actions.ts` next to that page. Shared actions live in `app/(group)/actions.ts`. DAL code lives in `lib/dal/`, never in `app/`.

## Open questions

- **Modal patterns.** Parallel + intercepting routes (`@modal/(.)client/new/`) are supported but not in v1 scope. Plain `<Dialog>` from shadcn suffices.
- **i18n.** English only for v1. Future: `app/[locale]/...`.
