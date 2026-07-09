import { Skeleton } from '@/components/ui/skeleton'

export default function ResetPasswordTokenLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <Skeleton className="h-8 w-48" />
      <div className="w-full max-w-sm border rounded-lg p-6 flex flex-col gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    </div>
  )
}
