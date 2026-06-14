import { requireRole } from '@/lib/dal/session'
import { AdminShell } from './admin-shell'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Defense-in-depth: proxy.ts already redirects non-admins away from /admin,
  // but the layout enforces it server-side too. This is the authoritative check.
  const user = await requireRole('SUPER_ADMIN')
  return (
    <AdminShell user={{ email: user.email, name: user.name }}>{children}</AdminShell>
  )
}
