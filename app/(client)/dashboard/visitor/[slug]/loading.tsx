import { Skeleton } from '@/components/ui/skeleton'

export default function VisitorDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-1" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="border rounded-lg">
        <div className="p-4 flex flex-col gap-3">
          <Skeleton className="h-5 w-40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
