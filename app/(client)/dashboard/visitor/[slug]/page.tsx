import { requireClientAccessBySlug } from '@/lib/dal/session'
import { prisma } from '@/lib/db'

export const metadata = { title: 'My dashboard — ClientConnect' }

export default async function ClientDashboard({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)

  const [submissions, comments] = await Promise.all([
    prisma.submission.findMany({
      where: { clientId },
      include: { form: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.comment.count({
      where: { clientId, isInternal: false },
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track your submissions and feedback here.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Submissions
          </div>
          <div className="text-2xl font-semibold mt-1">{submissions.length}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            Comments
          </div>
          <div className="text-2xl font-semibold mt-1">{comments}</div>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Your submissions</h2>
        {submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submissions yet. Visit <em>Forms</em> to get started.
          </p>
        ) : (
          <ul className="space-y-2">
            {submissions.map((s) => (
              <li
                key={s.id}
                className="border rounded-lg p-3 flex justify-between items-center"
              >
                <div>
                  <div className="font-medium">{s.form.title}</div>
                  <div className="text-xs text-muted-foreground">
                    Updated {s.updatedAt.toISOString().slice(0, 10)}
                  </div>
                </div>
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {s.status.replace('_', ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
