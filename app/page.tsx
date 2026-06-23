import { getCurrentUser } from '@/lib/dal/session'
import { dashboardForRole } from '@/lib/auth/session'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/landing/navbar'
import { HeroCarousel } from '@/components/landing/hero-carousel'
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
        <HeroCarousel />
        <DemoDashboard />
      </main>
      <Footer />
    </div>
  )
}
