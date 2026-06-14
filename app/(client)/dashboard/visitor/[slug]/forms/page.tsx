import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireClientAccessBySlug, getCurrentUser } from '@/lib/dal/session'

export const metadata = { title: 'Forms — ClientConnect' }

export default async function ClientFormsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)

  const forms = await prisma.form.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      submissions: {
        where: { clientId },
        select: { id: true, status: true, updatedAt: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Forms</h1>
        <p className="text-sm text-muted-foreground">
          Forms your team has asked you to complete.
        </p>
      </div>

      {forms.length === 0 ? (
        <div className="border rounded-lg p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No forms available yet. Check back soon.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {forms.map((f) => {
            const sub = f.submissions[0]
            return (
              <li key={f.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <div className="font-medium">{f.title}</div>
                    {f.description && (
                      <div className="text-sm text-muted-foreground mt-0.5">
                        {f.description}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {sub ? (
                      <>
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                          {sub.status.replace('_', ' ')}
                        </span>
                        <Link
                          href={`/dashboard/visitor/${slug}/submissions/${sub.id}`}
                          className="block text-sm text-primary hover:underline mt-1"
                        >
                          {sub.status === 'DRAFT' ? 'Continue' : 'View'}
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/dashboard/visitor/${slug}/submissions/new?formId=${f.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/80"
                      >
                        Start
                      </Link>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
