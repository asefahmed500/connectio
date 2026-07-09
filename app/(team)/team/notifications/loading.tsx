import { Skeleton } from '@/components/ui/skeleton'

export default function TeamNotificationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32 mt-1" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/4 mt-1" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
