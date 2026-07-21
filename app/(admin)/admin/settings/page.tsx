import { requireRole, getCurrentUser } from '@/lib/dal/session'
import { getSystemOverview } from '@/lib/dal/analytics'
import { getAllSettings } from '@/lib/dal/settings'
import { GeneralSettingsForm } from './general-settings-form'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Settings — ClientConnect' }

export default async function AdminSettingsPage() {
  await requireRole('SUPER_ADMIN')
  const user = await getCurrentUser()
  if (!user) return null

  const [stats, settings] = await Promise.all([
    getSystemOverview(),
    getAllSettings(),
  ])

  const smtpConfigured = !!(process.env.SMTP_HOST && process.env.SMTP_USER)
  const r2Configured = !!(process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET_NAME)
  const s3Configured = !!(process.env.S3_BUCKET && process.env.S3_REGION)
  const storageConfigured = r2Configured || s3Configured
  const redisConfigured = !!(process.env.UPSTASH_REDIS_REST_URL)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Settings</h1>
        <p className="text-sm text-muted-foreground">
          System configuration and overview.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">System overview</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-2 text-sm">
            <StatItem label="Total users" value={stats.totalUsers} />
            <StatItem label="Forms" value={stats.totalForms} />
            <StatItem label="Invites" value={stats.totalInvites} />
            <StatItem label="Submissions" value={stats.totalSubmissions} />
            <StatItem label="Files" value={stats.totalFiles} />
            <StatItem label="Comments" value={stats.totalComments} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Infrastructure status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <StatusRow label="SMTP (email)" configured={smtpConfigured} detail={smtpConfigured ? 'Configured' : 'Not configured'} />
          <StatusRow label="Storage" configured={storageConfigured} detail={r2Configured ? 'Cloudflare R2' : s3Configured ? 'Amazon S3' : 'Local FS (dev only)'} />
          <StatusRow label="Redis (rate limiting)" configured={redisConfigured} detail={redisConfigured ? 'Connected' : 'In-memory fallback'} />
          <StatusRow label="App URL" configured={!!process.env.NEXT_PUBLIC_APP_URL} detail={process.env.NEXT_PUBLIC_APP_URL ?? '(not set)'} />
          <StatusRow label="Environment" configured detail={process.env.NODE_ENV ?? 'development'} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Your account</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{user.name}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
            <dt className="text-muted-foreground">Role</dt>
            <dd>{user.role.replace('_', ' ')}</dd>
          </dl>
        </CardContent>
      </Card>

      <GeneralSettingsForm settings={settings} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-heading tracking-wide">Available features</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
          <div className="grid grid-cols-2 gap-2">
            <FeatureDot label="Password reset" done />
            <FeatureDot label="R2 / S3 storage" done={storageConfigured} />
            <FeatureDot label="Redis rate limiting" done={redisConfigured} />
            <FeatureDot label="Email delivery" done={smtpConfigured} />
            <FeatureDot label="Soft deletes" done />
            <FeatureDot label="Audit logging" done />
            <FeatureDot label="2FA" done />
            <FeatureDot label="SSO / OAuth" done />
            <FeatureDot label="SCIM provisioning" done />
            <FeatureDot label="GDPR erasure" done />
          </div>
        </CardContent>
      </Card>
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
        <span className={`size-2 rounded-full ${configured ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
        <span className="font-mono text-xs">{detail}</span>
      </div>
    </div>
  )
}

function FeatureDot({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-1.5 rounded-full ${done ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
      <span>{label}</span>
    </div>
  )
}
