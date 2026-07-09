import { Skeleton } from '@/components/ui/skeleton'

export default function NewFormLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32 mt-1" />
      </div>
      <div className="border rounded-lg p-6 flex flex-col gap-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-9 w-32" />
      </div>
    </div>
  )
}
