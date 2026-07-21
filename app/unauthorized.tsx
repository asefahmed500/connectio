import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Sign in required — ClientConnect' }

export default function Unauthorized() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Please sign in</h1>
        <p className="text-muted-foreground">You need to be signed in to view this page.</p>
        <Button asChild>
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    </div>
  )
}
