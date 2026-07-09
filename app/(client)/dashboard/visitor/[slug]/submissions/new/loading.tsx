import { Skeleton } from '@/components/ui/skeleton'

export default function NewSubmissionLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40 mt-1" />
      </div>
      <div className="border rounded-lg p-6 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  )
}
