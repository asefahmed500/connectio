import { Skeleton } from '@/components/ui/skeleton'

export default function VisitorTeamLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32 mt-1" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border rounded-lg p-4 flex flex-col items-center gap-3">
            <Skeleton className="h-16 w-16 rounded-full" />
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
