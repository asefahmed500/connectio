import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function InviteNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Invalid invite</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          This invite link is invalid or has expired.
        </p>
      </div>
      <Button asChild>
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  )
}
