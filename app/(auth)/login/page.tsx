import { Suspense } from 'react'
import { LoginForm } from './login-form'

export const metadata = { title: 'Log in — ClientConnect' }

export default function LoginPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">Sign in to your ClientConnect account.</p>
        </div>
        {/* useSearchParams() inside LoginForm requires a Suspense boundary
            for the page to be statically renderable. */}
        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
