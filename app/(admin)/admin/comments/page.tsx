import Link from 'next/link'
import { requireRole } from '@/lib/dal/session'
import { listAllCommentsForModeration } from '@/lib/dal/comments-moderation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Pagination } from '@/components/shared/pagination'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import { Search } from 'lucide-react'
import { ModerateDeleteButton } from './delete-button'

export const metadata = { title: 'Comments — ClientConnect' }

export default async function CommentsModerationPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    search?: string
    role?: string
    internal?: string
  }>
}) {
  await requireRole('SUPER_ADMIN')
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 25

  const result = await listAllCommentsForModeration({
    page,
    pageSize,
    search: params.search,
    authorRole: params.role && params.role !== 'all' ? params.role : undefined,
    internalOnly: params.internal === 'true',
  })

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/comments?${p.toString()}`
  }
  const currentParams: Record<string, string> = {
    ...(params.search ? { search: params.search } : {}),
    ...(params.role ? { role: params.role } : {}),
    ...(params.internal ? { internal: params.internal } : {}),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Comments</h1>
        <p className="text-sm text-muted-foreground">
          Cross-client comment moderation. Search, filter, and remove inappropriate content.
        </p>
      </div>

      <Card>
        <CardContent className="p-3">
          <form className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="search"
                  defaultValue={params.search ?? ''}
                  placeholder="Search comment text…"
                  className="pl-8"
                  aria-label="Search comments"
                />
              </div>
            </div>
            <Select name="role" defaultValue={params.role ?? 'all'}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Admin</SelectItem>
                <SelectItem value="TEAM_MEMBER">Team</SelectItem>
                <SelectItem value="CLIENT">Client</SelectItem>
              </SelectContent>
            </Select>
            <Select name="internal" defaultValue={params.internal ?? 'all'}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All visibility" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All visibility</SelectItem>
                <SelectItem value="true">Internal only</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="sm">Filter</Button>
            {(params.search || params.role || params.internal) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/comments">Clear</Link>
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No comments match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Comment</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Visibility</TableHead>
                  <TableHead>Posted</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.items.map((c) => (
                  <TableRow key={c.id} className={c.deletedAt ? 'opacity-50' : ''}>
                    <TableCell className="max-w-md">
                      <p className="text-sm line-clamp-2">{c.message}</p>
                      {c.deletedAt && (
                        <span className="text-xs text-muted-foreground italic">
                          (soft-deleted)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{c.authorName}</span>
                        <Badge variant="outline" className="w-fit mt-0.5">
                          {c.authorRole.replace('_', ' ')}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/admin/clients/${c.clientId}`}
                        className="text-sm hover:underline"
                      >
                        {c.clientName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={c.isInternal ? 'secondary' : 'default'}>
                        {c.isInternal ? 'Internal' : 'External'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.createdAt.toISOString().slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <ModerateDeleteButton commentId={c.id} disabled={!!c.deletedAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {result.totalPages > 1 && (
            <>
              <Separator />
              <Pagination
                page={page}
                pageSize={pageSize}
                total={result.total}
                totalPages={result.totalPages}
                buildHref={link}
                currentParams={currentParams}
              />
            </>
          )}
        </div>
      )}
    </div>
  )
}
