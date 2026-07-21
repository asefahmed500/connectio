import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = { title: 'Log in — ClientConnect' }

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/50 px-4">
      <div className="w-full max-w-sm flex flex-col gap-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-3xl font-heading tracking-wide">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your ClientConnect account.
          </p>
        </div>
        <Suspense fallback={<div className="text-sm text-muted-foreground text-center py-8">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
