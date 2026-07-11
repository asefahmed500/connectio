import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getClientDTO, listAllClients } from '@/lib/dal/clients'
import { listSubmissionsWithSchema } from '@/lib/dal/submissions'
import { listAssignedTeamMembers, listUnassignedTeamMembers } from '@/lib/dal/team'
import { SubmissionReviewer } from '@/components/submissions/submission-reviewer'
import { parseFormSchema } from '@/lib/forms/schema'
import { LiveChat } from '@/components/comments/live-chat'
import { AssignTeamForm } from './assign-team-form'
import { UnassignTeamButton } from './unassign-button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Palette } from 'lucide-react'

export const metadata = { title: 'Client — ClientConnect' }

export async function generateStaticParams() {
  const result = await listAllClients().catch(() => ({ items: [] }))
  return result.items.map((c) => ({ id: c.id }))
}

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClientDTO(id).catch(() => null)
  if (!client) notFound()

  const submissions = await listSubmissionsWithSchema(id)
  const assignedMembers = await listAssignedTeamMembers(id)
  const unassignedMembers = await listUnassignedTeamMembers(id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:text-foreground">
          ← All clients
        </Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="text-3xl font-heading tracking-wide">{client.companyName}</h1>
          <Link
            href={`/admin/clients/${id}/edit`}
            className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium hover:bg-muted"
          >
            Edit details
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          {client.contactName} · /{client.uniqueSlug}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Submissions</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{submissions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Messages</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{client.commentsCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription>Files</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{client.filesCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Portal branding</h2>
        <Card>
          <CardContent className="p-4">
            <Link
              href={`/admin/clients/${id}/branding`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Palette className="w-4 h-4" />
              Customize logo, colors, and portal appearance
            </Link>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Team</h2>
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            {assignedMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {assignedMembers.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.name}</span>
                      <Badge variant="secondary" className="text-xs">{m.email}</Badge>
                    </div>
                    <UnassignTeamButton teamMemberId={m.teamMemberId} clientId={id} />
                  </li>
                ))}
              </ul>
            )}
            {unassignedMembers.length > 0 && (
              <Separator />
            )}
            {unassignedMembers.length > 0 && (
              <AssignTeamForm clientId={id} teamMembers={unassignedMembers} />
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Submissions</h2>
        {submissions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No submissions yet.
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {submissions.map((s) => {
              const schema = parseFormSchema(s.formSchema as unknown)
              return (
                <Card key={s.id}>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{s.formTitle}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Updated {s.updatedAt.toISOString().slice(0, 10)} ·{' '}
                          {schema.fields.length} fields
                        </div>
                      </div>
                      <Badge variant="outline">{s.status.replace('_', ' ')}</Badge>
                    </div>
                    <details>
                      <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                        View submitted data
                      </summary>
                      <dl className="grid grid-cols-1 gap-1 text-sm mt-2 pl-4">
                        {schema.fields.map((f) => {
                          const v = (s.formData as Record<string, unknown>)?.[f.name]
                          const display = Array.isArray(v)
                            ? v.join(', ')
                            : v === undefined || v === ''
                              ? '—'
                              : String(v)
                          return (
                            <div key={f.name} className="grid grid-cols-3 gap-2">
                              <dt className="text-muted-foreground">{f.label}</dt>
                              <dd className="col-span-2 break-words">{display}</dd>
                            </div>
                          )
                        })}
                      </dl>
                    </details>
                    <SubmissionReviewer submissionId={s.id} status={s.status} />
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Messages</h2>
        <Card>
          <CardContent className="p-4">
            <LiveChat clientId={id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
