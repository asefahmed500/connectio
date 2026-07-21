import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/dal/session'

export const dynamic = 'force-dynamic'

export default async function ClientNotFound() {
  // Resolve the visitor's slug from the session so the "back to dashboard"
  // link actually goes somewhere. Unauthenticated viewers get sent to /login.
  const user = await getCurrentUser()
  const slug = user?.client?.uniqueSlug
  const href = slug ? `/dashboard/visitor/${slug}` : '/login'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The page you are looking for does not exist.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href={href}>Back to dashboard</Link>
      </Button>
    </div>
  )
}
