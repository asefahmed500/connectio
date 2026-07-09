import { Skeleton } from '@/components/ui/skeleton'

export default function InviteLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-9 w-32" />
    </div>
  )
}
