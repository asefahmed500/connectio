import { Skeleton } from '@/components/ui/skeleton'

export default function FormDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32 mt-1" />
      </div>
      <div className="border rounded-lg p-6 flex flex-col gap-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
    </div>
  )
}
