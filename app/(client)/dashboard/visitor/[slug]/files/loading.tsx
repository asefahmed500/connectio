import { Skeleton } from '@/components/ui/skeleton'

export default function VisitorFilesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-32 mt-1" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="border rounded-lg">
        <div className="p-4 flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24 mt-1" />
              </div>
              <Skeleton className="h-8 w-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
