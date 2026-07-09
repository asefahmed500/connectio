import { Skeleton } from '@/components/ui/skeleton'

export default function SubmissionDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-40 mt-1" />
      </div>
      <div className="border rounded-lg p-6 flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="border rounded-lg p-6 flex flex-col gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    </div>
  )
}
