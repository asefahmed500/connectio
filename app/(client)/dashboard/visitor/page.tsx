// Bare /dashboard/visitor catch-page.
//
// The proxy can't build the client's full URL (/dashboard/visitor/<slug>) on a
// redirect because the access token carries only the clientId, not the slug —
// so an authenticated client hitting an auth-only route (or this path
// directly) lands here. Resolve the slug from the session and bounce to the
// real dashboard. The (client) layout already enforces requireRole('CLIENT').

import { redirect, notFound } from 'next/navigation'
import { requireSession } from '@/lib/dal/session'

export default async function VisitorIndexPage() {
  const user = await requireSession()
  const slug = user.client?.uniqueSlug
  if (user.role === 'CLIENT' && slug) {
    redirect(`/dashboard/visitor/${slug}`)
  }
  notFound()
}
