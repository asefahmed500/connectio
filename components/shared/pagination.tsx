import Link from 'next/link'
import { cn } from '@/lib/utils'

export type PaginationProps = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  buildHref: (params: Record<string, string>) => string
  currentParams?: Record<string, string>
}

export function Pagination({ page, pageSize, total, totalPages, buildHref, currentParams = {} }: PaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between pt-4">
      <span className="text-xs text-muted-foreground">
        Showing {from} to {to} of {total}
      </span>
      <div className="flex gap-2">
        <Link
          href={buildHref({ ...currentParams, page: String(page - 1), pageSize: String(pageSize) })}
          className={cn(
            'inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium',
            page <= 1 ? 'pointer-events-none opacity-50' : 'hover:bg-muted',
          )}
        >
          Previous
        </Link>
        <Link
          href={buildHref({ ...currentParams, page: String(page + 1), pageSize: String(pageSize) })}
          className={cn(
            'inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium',
            page >= totalPages ? 'pointer-events-none opacity-50' : 'hover:bg-muted',
          )}
        >
          Next
        </Link>
      </div>
    </div>
  )
}
