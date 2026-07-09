import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { listUsers } from '@/lib/dal/users'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '@/components/ui/table'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { Search } from 'lucide-react'
import { ExportCsvButton } from '@/components/admin/export-csv-button'
import { bulkBlockAction, bulkDeleteAction } from './actions'
import { SelectAllCheckbox } from './bulk-actions'
import { Ban, Trash2 } from 'lucide-react'

export const metadata = { title: 'Users — ClientConnect' }

function roleVariant(role: string) {
  if (role === 'SUPER_ADMIN') return 'default' as const
  if (role === 'TEAM_MEMBER') return 'secondary' as const
  return 'outline' as const
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string; search?: string; role?: string; status?: string }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const pageSize = params.pageSize ? parseInt(params.pageSize, 10) : 20

  const result = await listUsers({
    page,
    pageSize,
    search: params.search,
    role: params.role,
    status: params.status,
  })

  function link(q: Record<string, string>) {
    const p = new URLSearchParams(q)
    return `/admin/users?${p}`
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Users</h1>
        <p className="text-sm text-muted-foreground">Manage all user accounts.</p>
      </div>

      <Card>
        <CardContent className="p-3">
          <form className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input name="search" defaultValue={params.search ?? ''} placeholder="Search by name or email…" className="pl-8" />
              </div>
            </div>
            <Select name="role" defaultValue={params.role ?? ''}>
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="All roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All roles</SelectItem>
                <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                <SelectItem value="TEAM_MEMBER">Team Member</SelectItem>
                <SelectItem value="CLIENT">Client</SelectItem>
              </SelectContent>
            </Select>
            <Select name="status" defaultValue={params.status ?? ''}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" size="sm">Filter</Button>
            {(params.search || params.role || params.status) && (
              <Link href="/admin/users">
                <Button variant="ghost" size="sm">Clear</Button>
              </Link>
            )}
          </form>
          <div className="mt-3 flex justify-end">
            <ExportCsvButton
              fetchUrl="/api/admin/export?type=users"
              filename="users.csv"
              columns={[
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'role', label: 'Role' },
                { key: 'isActive', label: 'Active', format: (v) => v ? 'Yes' : 'No' },
              ]}
            />
          </div>
        </CardContent>
      </Card>

      {result.items.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No users found.
          </CardContent>
        </Card>
      ) : (
        <form className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <SelectAllCheckbox count={result.items.length} />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                formAction={bulkBlockAction}
                className="inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium hover:bg-muted gap-1"
              >
                <Ban className="w-3 h-3" />
                Block / Unblock
              </button>
              <button
                type="submit"
                formAction={bulkDeleteAction}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-destructive px-3 text-xs font-medium text-destructive hover:bg-destructive/10 gap-1"
                onClick={(e) => {
                  if (!confirm('Delete selected users? This cannot be undone.')) e.preventDefault()
                }}
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.items.map((u) => (
                <TableRow key={u.id} className={cn(!u.isActive && 'opacity-60')}>
                  <TableCell>
                    <input
                      type="checkbox"
                      name="userIds"
                      value={u.id}
                      aria-label={`Select ${u.name}`}
                      className="rounded border-gray-300 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant={roleVariant(u.role)}>{u.role.replace('_', ' ')}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? 'outline' : 'destructive'}>
                      {u.isActive ? 'Active' : 'Blocked'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 10) : 'Never'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/users/${u.id}`} className="text-primary hover:underline text-sm">
                      Manage
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {result.totalPages > 1 && (
            <>
              <Separator />
              <div className="flex items-center justify-between pt-4">
                <span className="text-xs text-muted-foreground">
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, result.total)} of {result.total}
                </span>
                <div className="flex gap-2">
                  <Link
                    href={link({ ...params, page: String(page - 1), pageSize: String(pageSize) })}
                    className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                  >
                    Previous
                  </Link>
                  <Link
                    href={link({ ...params, page: String(page + 1), pageSize: String(pageSize) })}
                    className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page >= result.totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                  >
                    Next
                  </Link>
                </div>
              </div>
            </>
          )}
        </form>
      )}
    </div>
  )
}
