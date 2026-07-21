import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifyMfaToken } from '@/lib/auth/tokens'
import { Card, CardContent } from '@/components/ui/card'
import { TwoFactorForm } from './two-factor-form'

export const metadata = { title: 'Two-factor authentication — ClientConnect' }

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const cs = await cookies()
  const mfaToken = cs.get('mfa_token')?.value
  const { next } = await searchParams

  const { ok } = await verifyMfaToken(mfaToken)
  if (!ok) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-3xl font-heading tracking-wide">Two-factor authentication</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Verify it&rsquo;s you to continue.
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            <TwoFactorForm next={next} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
