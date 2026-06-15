import { Suspense } from 'react'
import { verifyResetToken } from '@/lib/dal/password-reset'
import { notFound } from 'next/navigation'
import { ResetPasswordForm } from './reset-password-form'

export const metadata = { title: 'Set new password — ClientConnect' }

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const valid = await verifyResetToken(token)
  if (!valid) notFound()

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Loading…</div>}>
          <ResetPasswordForm token={token} />
        </Suspense>
      </div>
    </div>
  )
}
