import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { getClientDTO, listAllClients } from '@/lib/dal/clients'
import { SubmissionReviewer } from '@/components/submissions/submission-reviewer'
import { parseFormSchema } from '@/lib/forms/schema'
import { CommentThread } from '@/components/comments/comment-thread'

export const metadata = { title: 'Client — ClientConnect' }

export async function generateStaticParams() {
  const clients = await listAllClients().catch(() => [])
  return clients.map((c) => ({ id: c.id }))
}

export default async function AdminClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const client = await getClientDTO(id).catch(() => null)
  if (!client) notFound()

  const [submissions, comments, files] = await Promise.all([
    prisma.submission.findMany({
      where: { clientId: id },
      include: { form: { select: { title: true, formSchema: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.comment.count({ where: { clientId: id, isInternal: false } }),
    prisma.file.count({ where: { clientId: id } }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clients" className="text-sm text-muted-foreground hover:text-foreground">
          ← All clients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">{client.companyName}</h1>
        <p className="text-sm text-muted-foreground">
          {client.contactName} · /{client.uniqueSlug}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Submissions" value={submissions.length} />
        <Stat label="External comments" value={comments} />
        <Stat label="Files" value={files} />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Submissions</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No submissions yet.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => {
              const schema = parseFormSchema(s.form.formSchema as unknown)
              return (
                <div key={s.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{s.form.title}</div>
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
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Messages</h2>
        <div className="border rounded-lg p-4">
          <CommentThread clientId={id} />
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-0.5">{value}</div>
    </div>
  )
}
