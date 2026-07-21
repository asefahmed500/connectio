import { redirect } from 'next/navigation'
import { requireRole, getCurrentUser } from '@/lib/dal/session'
import { getClientSettings } from '@/lib/dal/client-settings'
import { isMaintenanceMode } from '@/lib/dal/settings'
import { ClientShell } from './client-shell'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('CLIENT')
  if (!user.client) redirect('/login')

  // Maintenance mode: block client portal access. SUPER_ADMIN bypasses so they
  // can still debug the portal during an outage.
  if (await isMaintenanceMode()) {
    const currentUser = await getCurrentUser()
    if (currentUser?.role !== 'SUPER_ADMIN') {
      redirect('/maintenance')
    }
  }

  const settings = await getClientSettings(user.client.id)

  return (
    <ClientShell
      user={{ email: user.email, name: user.name }}
      slug={user.client.uniqueSlug}
      settings={settings ?? undefined}
    >
      {children}
    </ClientShell>
  )
}
