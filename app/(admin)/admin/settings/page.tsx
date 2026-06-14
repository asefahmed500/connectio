import { requireRole } from '@/lib/dal/session'
import { getCurrentUser } from '@/lib/dal/session'
import { prisma } from '@/lib/db'

export const metadata = { title: 'Settings — ClientConnect' }

export default async function AdminSettingsPage() {
  await requireRole('SUPER_ADMIN')
  const user = await getCurrentUser()
  if (!user) return null

  // Counts for the system overview panel.
  const [users, forms, invites] = await Promise.all([
    prisma.user.count(),
    prisma.form.count(),
    prisma.invite.count(),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          System overview and configuration. (More options land in future milestones.)
        </p>
      </div>

      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold">System overview</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Total users</dt>
          <dd className="tabular-nums">{users}</dd>
          <dt className="text-muted-foreground">Forms</dt>
          <dd className="tabular-nums">{forms}</dd>
          <dt className="text-muted-foreground">Invites (all-time)</dt>
          <dd className="tabular-nums">{invites}</dd>
          <dt className="text-muted-foreground">App URL</dt>
          <dd className="font-mono text-xs">
            {process.env.NEXT_PUBLIC_APP_URL ?? '(not set)'}
          </dd>
          <dt className="text-muted-foreground">Environment</dt>
          <dd className="font-mono text-xs">{process.env.NODE_ENV}</dd>
        </dl>
      </section>

      <section className="border rounded-lg p-4 space-y-2">
        <h2 className="text-sm font-semibold">Your account</h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>{user.role.replace('_', ' ')}</dd>
        </dl>
      </section>

      <section className="border rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">Coming later</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Change password</li>
          <li>Two-factor authentication (Tier 0 milestone)</li>
          <li>Email notification preferences</li>
          <li>Branding + sender name customization</li>
        </ul>
      </section>
    </div>
  )
}
