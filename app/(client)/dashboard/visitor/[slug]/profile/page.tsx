import Link from 'next/link'
import { Download, Key, Trash2, User as UserIcon, ShieldCheck } from 'lucide-react'
import { requireClientAccessBySlug, getCurrentUser } from '@/lib/dal/session'
import { getTwoFactorStatus } from '@/lib/dal/two-factor'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { requestErasureAction } from './actions'
import { TwoFactorSettings } from './two-factor-settings'
import { ChangePasswordForm } from './change-password-form'

export const metadata = { title: 'Profile — ClientConnect' }

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  await requireClientAccessBySlug(slug)
  const user = await getCurrentUser()
  const twoFactor = await getTwoFactorStatus()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserIcon className="h-4 w-4" />
            Account details
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Name</Label>
            <p className="text-sm font-medium">{user?.name ?? '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Email</Label>
            <p className="text-sm font-medium">{user?.email ?? '—'}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Role</Label>
            <p className="text-sm font-medium">Client</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="h-4 w-4" />
            Change password
          </CardTitle>
          <CardDescription>Update your password. Must be at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm slug={slug} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Two-factor authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security with a time-based one-time password (TOTP).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorSettings enabled={twoFactor.enabled} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            Data &amp; privacy
          </CardTitle>
          <CardDescription>
            Download your data or request account erasure (GDPR).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 max-w-sm">
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">Export all your personal data as JSON, including submissions, messages, and files.</p>
            <Link href="/api/account/export" download>
              <Button variant="outline" size="sm">
                <Download className="h-3.5 w-3.5" />
                Export my data
              </Button>
            </Link>
          </div>

          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              Request deletion of all personal data. This action is irreversible and subject to admin approval.
            </p>
            <form action={requestErasureAction.bind(null, slug)}>
              <Button type="submit" variant="destructive" size="sm">
                <Trash2 className="h-3.5 w-3.5" />
                Request account erasure
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
