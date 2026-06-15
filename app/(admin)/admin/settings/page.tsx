import { requireRole } from '@/lib/dal/session'
import { getCurrentUser } from '@/lib/dal/session'
import { prisma } from '@/lib/db'
import { GeneralSettingsForm } from './general-settings-form'

export const metadata = { title: 'Settings — ClientConnect' }

export default async function AdminSettingsPage() {
  await requireRole('SUPER_ADMIN')
  const user = await getCurrentUser()
  if (!user) return null

  const [users, forms, invites, totalSubmissions, totalFiles, totalComments] = await Promise.all([
    prisma.user.count(),
    prisma.form.count({ where: { deletedAt: null } }),
    prisma.invite.count(),
    prisma.submission.count({ where: { deletedAt: null } }),
    prisma.file.count({ where: { deletedAt: null } }),
    prisma.comment.count({ where: { deletedAt: null } }),
  ])

  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER)
  const r2Configured = !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET_NAME)
  const s3Configured = !!(process.env.S3_BUCKET && process.env.S3_REGION)
  const storageConfigured = r2Configured || s3Configured
  const redisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL)

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          System configuration and overview.
        </p>
      </div>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">System overview</h2>
        <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-2 text-sm">
          <StatItem label="Total users" value={users} />
          <StatItem label="Forms" value={forms} />
          <StatItem label="Invites" value={invites} />
          <StatItem label="Submissions" value={totalSubmissions} />
          <StatItem label="Files" value={totalFiles} />
          <StatItem label="Comments" value={totalComments} />
        </dl>
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Infrastructure status</h2>
        <dl className="space-y-2 text-sm">
          <StatusRow label="SMTP (email)" configured={smtpConfigured} detail={smtpConfigured ? 'Configured' : 'Not configured'} />
          <StatusRow label="Storage" configured={storageConfigured} detail={r2Configured ? 'Cloudflare R2' : s3Configured ? 'Amazon S3' : 'Local FS (dev only)'} />
          <StatusRow label="Redis (rate limiting)" configured={redisConfigured} detail={redisConfigured ? 'Connected' : 'In-memory fallback'} />
          <StatusRow label="App URL" configured={!!process.env.NEXT_PUBLIC_APP_URL} detail={process.env.NEXT_PUBLIC_APP_URL ?? '(not set)'} />
          <StatusRow label="Environment" configured detail={process.env.NODE_ENV ?? 'development'} />
        </dl>
      </section>

      <section className="border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Your account</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Name</dt>
          <dd>{user.name}</dd>
          <dt className="text-muted-foreground">Email</dt>
          <dd>{user.email}</dd>
          <dt className="text-muted-foreground">Role</dt>
          <dd>{user.role.replace('_', ' ')}</dd>
        </dl>
      </section>

      <GeneralSettingsForm />

      <section className="border rounded-lg p-4 space-y-2 text-sm text-muted-foreground">
        <h2 className="text-sm font-semibold text-foreground">Available features</h2>
        <div className="grid grid-cols-2 gap-2">
          <FeatureDot label="Password reset" done />
          <FeatureDot label="R2 / S3 storage" done={storageConfigured} />
          <FeatureDot label="Redis rate limiting" done={redisConfigured} />
          <FeatureDot label="Email delivery" done={smtpConfigured} />
          <FeatureDot label="Soft deletes" done />
          <FeatureDot label="Audit logging" done />
          <FeatureDot label="2FA" done={false} />
          <FeatureDot label="SSO / OAuth" done={false} />
        </div>
      </section>
    </div>
  )
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums font-medium">{value.toLocaleString()}</dd>
    </>
  )
}

function StatusRow({ label, configured, detail }: { label: string; configured: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`size-2 rounded-full ${configured ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="font-mono text-xs">{detail}</span>
      </div>
    </div>
  )
}

function FeatureDot({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${done ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
      <span>{label}</span>
    </div>
  )
}
