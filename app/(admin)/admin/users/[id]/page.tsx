import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getUserDTO } from '@/lib/dal/users'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { UserEditForm } from './edit-form'
import { BlockButton } from './block-button'
import { ResetPasswordButton } from './reset-password-button'
import { DeleteButton } from './delete-button'

export const metadata = { title: 'User — ClientConnect' }

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getUserDTO(id)
  if (!user) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/users" className="text-sm text-muted-foreground hover:text-foreground">
          ← All users
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">{user.name}</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">Role</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Badge variant={user.role === 'SUPER_ADMIN' ? 'default' : user.role === 'TEAM_MEMBER' ? 'secondary' : 'outline'}>
              {user.role.replace('_', ' ')}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <Badge variant={user.isActive ? 'outline' : 'destructive'}>
              {user.isActive ? 'Active' : 'Blocked'}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-sm font-normal text-muted-foreground">Last login</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            <span className="text-sm">{user.lastLoginAt ? user.lastLoginAt.toISOString().slice(0, 10) : 'Never'}</span>
          </CardContent>
        </Card>
      </div>

      {user.client && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="font-medium">{user.client.companyName}</span>
              <span className="text-xs text-muted-foreground ml-2">/{user.client.uniqueSlug}</span>
            </div>
            <Link href={`/admin/clients/${user.client.id}`}>
              <Button variant="outline" size="sm">View client</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {user.teamMember && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="font-medium">Team Member</span>
              {user.teamMember.department && (
                <span className="text-xs text-muted-foreground ml-2">{user.teamMember.department}</span>
              )}
            </div>
            <Link href={`/admin/team/${user.teamMember.id}`}>
              <Button variant="outline" size="sm">View team</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Separator />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Edit user</h2>
        <UserEditForm user={user} />
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Actions</h2>
        <div className="flex gap-3 flex-wrap">
          <BlockButton userId={user.id} isActive={user.isActive} />
          <ResetPasswordButton userId={user.id} userName={user.name} />
          <DeleteButton userId={user.id} userName={user.name} />
        </div>
      </div>
    </div>
  )
}
