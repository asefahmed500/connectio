import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Maintenance — ClientConnect' }

export default function MaintenancePage() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-heading tracking-wide">Under maintenance</h1>
          <p className="text-muted-foreground">
            We&apos;re performing scheduled maintenance on the portal. Please check
            back shortly.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/login">Try signing in</Link>
        </Button>
      </div>
    </div>
  )
}
