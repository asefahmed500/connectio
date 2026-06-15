import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser, requireClientAccess } from '@/lib/dal/session'
import { prisma } from '@/lib/db'
import { parseFormSchema } from '@/lib/forms/schema'
import { SubmissionReviewer } from '@/components/submissions/submission-reviewer'

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

  const client = await prisma.client.findUniqueOrThrow({ where: { id, deletedAt: null } })
  const submissions = await prisma.submission.findMany({
    where: { clientId: id, deletedAt: null },
    include: { form: { select: { title: true, formSchema: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div>
        <Link href="/team/clients" className="text-sm text-muted-foreground hover:text-foreground">
          ← My clients
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">{client.companyName}</h1>
        <p className="text-sm text-muted-foreground">
          {client.contactName} · /{client.uniqueSlug}
        </p>
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
    </div>
  )
}
