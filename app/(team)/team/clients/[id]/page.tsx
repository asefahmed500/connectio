import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser, requireClientAccess } from '@/lib/dal/session'
import { getClientDTO } from '@/lib/dal/clients'
import { listSubmissionsWithSchema } from '@/lib/dal/submissions'
import { parseFormSchema } from '@/lib/forms/schema'
import { SubmissionReviewer } from '@/components/submissions/submission-reviewer'
import { CommentThread } from '@/components/comments/comment-thread'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Client — ClientConnect' }

export default async function TeamClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user?.teamMember) return null

  try {
    await requireClientAccess(id)
  } catch {
    notFound()
  }

  const client = await getClientDTO(id)
  if (!client) notFound()

  const submissions = await listSubmissionsWithSchema(id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/team/clients" className="text-sm text-muted-foreground hover:text-foreground">
          ← My clients
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">{client.companyName}</h1>
        <p className="text-sm text-muted-foreground">
          {client.contactName} · /{client.uniqueSlug}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription>Submissions</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{submissions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription>Files</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{client.filesCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1">
            <CardDescription>Messages</CardDescription>
            <CardTitle className="text-2xl tabular-nums">{client.commentsCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Submissions</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {submissions.map((s) => {
              const schema = parseFormSchema(s.formSchema as unknown)
              return (
                <Card key={s.id}>
                  <CardContent className="p-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">{s.formTitle}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Updated {s.updatedAt.toISOString().slice(0, 10)} ·{' '}
                          {schema.fields.length} fields
                        </div>
                      </div>
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {s.status.replace('_', ' ')}
                      </span>
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

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Messages</h2>
        <Card>
          <CardContent className="p-4">
            <CommentThread clientId={id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
