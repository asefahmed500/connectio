import { listInvites } from '@/lib/dal/invites'
import { CreateInviteForm } from './create-form'
import { RevokeButton } from './revoke-button'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export const metadata = { title: 'Invites — ClientConnect' }

export default async function InvitesPage() {
  const { items: invites } = await listInvites({ pageSize: 50 })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Invites</h1>
        <p className="text-sm text-muted-foreground">
          Generate invite links for new clients. Each link is valid for 7 days.
        </p>
      </div>

      <CreateInviteForm />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Recent invites</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>{i.email}</TableCell>
                  <TableCell>{i.companyName}</TableCell>
                  <TableCell className="font-mono text-xs">{i.slug}</TableCell>
                  <TableCell><StatusBadge status={i.status} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {i.createdAt.toISOString().slice(0, 10)}
                  </TableCell>
                  <TableCell>{i.status === 'OPEN' && <RevokeButton slug={i.slug} />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'OPEN'
      ? 'default' as const
      : status === 'CONSUMED'
        ? 'secondary' as const
        : 'outline' as const
  const label = status === 'OPEN' ? 'Open' : status === 'CONSUMED' ? 'Consumed' : status
  return <Badge variant={variant}>{label}</Badge>
}
