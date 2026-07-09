import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function AuthNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Page not found</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The page you are looking for does not exist.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/login">Back to login</Link>
      </Button>
    </div>
  )
}
