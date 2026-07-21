import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function LoginLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <Skeleton className="h-8 w-32" />
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 flex flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
