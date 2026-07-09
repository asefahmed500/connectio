import { Skeleton } from '@/components/ui/skeleton'

export default function TeamDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32 mt-1" />
      </div>
      <div className="border rounded-lg p-6 flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="border rounded-lg p-6 flex flex-col gap-3">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
