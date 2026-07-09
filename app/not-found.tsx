import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function GlobalNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight">404</h1>
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The page you are looking for does not exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
        <Button asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </div>
  )
}
