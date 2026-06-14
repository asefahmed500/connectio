import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const metadata = { title: 'Access denied — ClientConnect' }

export default function Forbidden() {
  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Access denied</h1>
        <p className="text-muted-foreground">You don&apos;t have permission to view this page.</p>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  )
}
