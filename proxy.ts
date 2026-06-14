// Next.js 16 renames `middleware.ts` → `proxy.ts`. Same role, different name.
// See docs/08-routing-and-ui-layout.md.
//
// This is OPTIMISTIC ONLY:
//   - Verifies the access cookie via JWT crypto (no DB).
//   - Redirects unauthenticated users away from protected routes.
//   - Redirects authenticated users away from auth-only routes.
//
// Real authorization happens in the DAL (lib/dal/session.ts). Don't add DB
// work here — proxy runs on every request including prefetches.

import { NextResponse, type NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/tokens'

const PROTECTED_PREFIXES = ['/admin', '/team', '/dashboard/visitor']
const AUTH_ONLY_PATHS = new Set(['/login', '/forgot-password', '/reset-password'])

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname

  // Skip static assets and API routes — handlers do their own auth.
  if (path === '/favicon.ico' || path.startsWith('/_next') || path.startsWith('/api')) {
    return NextResponse.next()
  }

  const token = req.cookies.get('access_token')?.value
  const result = await verifyAccessToken(token)
  const claims = result.ok ? result.claims : null

  const isProtected = PROTECTED_PREFIXES.some((p) => path.startsWith(p))
  const isAuthOnly = AUTH_ONLY_PATHS.has(path)

  // Protected + no valid session → /login?next=<original>
  if (isProtected && !claims) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  // Auth-only + valid session → user's dashboard.
  if (claims && isAuthOnly) {
    const dest =
      claims.role === 'SUPER_ADMIN'
        ? '/admin'
        : claims.role === 'TEAM_MEMBER'
          ? '/team'
          : '/dashboard/visitor'
    return NextResponse.redirect(new URL(dest, req.nextUrl))
  }

  // Cross-role guard: a CLIENT hitting /admin or /team gets redirected.
  // (The DAL would call forbidden() anyway; this avoids a wasted render.)
  if (claims && isProtected) {
    const wrongArea =
      (claims.role === 'CLIENT' && (path.startsWith('/admin') || path.startsWith('/team'))) ||
      (claims.role === 'TEAM_MEMBER' && path.startsWith('/admin')) ||
      (claims.role === 'SUPER_ADMIN' && path.startsWith('/team'))
    if (wrongArea) {
      const dest =
        claims.role === 'CLIENT' ? '/dashboard/visitor' : '/admin'
      return NextResponse.redirect(new URL(dest, req.nextUrl))
    }
  }

  return NextResponse.next()
}

export const config = {
  // Run on everything except static assets, API, and Next internals.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
