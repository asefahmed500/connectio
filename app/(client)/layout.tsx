import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/dal/session'
import { getClientSettings } from '@/lib/dal/client-settings'
import { ClientShell } from './client-shell'

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await requireRole('CLIENT')
  if (!user.client) redirect('/login')

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
