import { prisma } from '@/lib/db'
import { CreateInviteForm } from './create-form'
import { RevokeButton } from './revoke-button'

export const metadata = { title: 'Invites — ClientConnect' }

export default async function InvitesPage() {
  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
        <p className="text-sm text-muted-foreground">
          Generate invite links for new clients. Each link is valid for 7 days.
        </p>
      </div>

      <CreateInviteForm />

      <div>
        <h2 className="text-lg font-semibold mb-3">Recent invites</h2>
        {invites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No invites yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Email</th>
                <th className="pr-3">Company</th>
                <th className="pr-3">Slug</th>
                <th className="pr-3">Status</th>
                <th className="pr-3">Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{i.email}</td>
                  <td className="pr-3">{i.companyName}</td>
                  <td className="pr-3 font-mono text-xs">{i.slug}</td>
                  <td className="pr-3">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="pr-3 text-muted-foreground">
                    {i.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td>{i.status === 'OPEN' && <RevokeButton slug={i.slug} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'OPEN'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
      : status === 'CONSUMED'
        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
        : 'bg-muted text-muted-foreground'
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status}
    </span>
  )
}
