import { Suspense } from 'react'
import { ForgotPasswordForm } from './forgot-password-form'

export const metadata = { title: 'Reset password — ClientConnect' }

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="text-sm text-muted-foreground text-center">Loading…</div>}>
          <ForgotPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
