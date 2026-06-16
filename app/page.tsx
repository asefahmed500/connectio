import { getCurrentUser } from '@/lib/dal/session'
import { dashboardForRole } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/landing/navbar'
import { DemoDashboard } from '@/components/landing/demo-dashboard'
import { Footer } from '@/components/landing/footer'

export default async function Home() {
  const user = await getCurrentUser()
  if (user) {
    redirect(dashboardForRole(user.role, user.client?.uniqueSlug))
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <section className="flex items-center justify-center px-6 pt-28 pb-16 sm:pt-32 sm:pb-20">
          <div className="flex flex-col items-center gap-6 text-center max-w-lg">
            <h1 className="text-4xl font-heading tracking-wide sm:text-5xl text-balance">
              Secure client portal
            </h1>
            <p className="text-muted-foreground text-balance max-w-sm">
              Post-meeting client communication and requirement gathering — all in one place, with audit trails.
            </p>
            <a
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-8 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign in
            </a>
          </div>
        </section>
        <DemoDashboard />
      </main>
      <Footer />
    </div>
  )
}
