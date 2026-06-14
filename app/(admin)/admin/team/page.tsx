import Link from 'next/link'
import { listAllTeamMembers } from '@/lib/dal/team'
import { AddTeamMemberForm } from './add-form'

export const metadata = { title: 'Team — ClientConnect' }

export default async function AdminTeamPage() {
  const members = await listAllTeamMembers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Team members</h1>
        <p className="text-sm text-muted-foreground">
          Add team members and assign them to specific clients.
        </p>
      </div>

      <AddTeamMemberForm />

      <div>
        <h2 className="text-lg font-semibold mb-3">All team members ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">No team members yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Name</th>
                <th className="pr-3">Email</th>
                <th className="pr-3">Department</th>
                <th className="pr-3">Clients</th>
                <th className="pr-3">Added</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-medium">{m.name}</td>
                  <td className="pr-3">{m.email}</td>
                  <td className="pr-3">{m.department ?? '—'}</td>
                  <td className="pr-3 tabular-nums">{m.assignedClientCount}</td>
                  <td className="pr-3 text-muted-foreground">
                    {m.createdAt.toISOString().slice(0, 10)}
                  </td>
                  <td>
                    <Link
                      href={`/admin/team/${m.id}`}
                      className="text-primary hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
