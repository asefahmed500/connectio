import { getCurrentUser } from '@/lib/dal/session'
import { dashboardForRole } from '@/lib/auth/session'
import { redirect } from 'next/navigation'

export default async function Home() {
  const user = await getCurrentUser()
  if (user) {
    redirect(dashboardForRole(user.role, user.client?.uniqueSlug))
  }
  // Anonymous → show a simple landing that links to login.
  // (Register is invite-only; no public signup.)
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center space-y-4 max-w-md">
        <h1 className="text-4xl font-semibold tracking-tight">ClientConnect Portal</h1>
        <p className="text-muted-foreground">
          Post-meeting client communication and requirement gathering.
        </p>
        <a
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-primary/80"
        >
          Sign in
        </a>
      </div>
    </div>
  )
}
