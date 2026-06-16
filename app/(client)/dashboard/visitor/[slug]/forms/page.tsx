import Link from 'next/link'
import { requireClientAccessBySlug } from '@/lib/dal/session'
import { listActiveFormsForClient } from '@/lib/dal/forms'
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card'

export const metadata = { title: 'Forms — ClientConnect' }

export default async function ClientFormsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)

  const forms = await listActiveFormsForClient(clientId)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Forms</h1>
        <p className="text-sm text-muted-foreground">
          Forms your team has asked you to complete.
        </p>
      </div>

      {forms.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No forms available yet. Check back soon.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {forms.map((f) => {
            const sub = f.submission
            return (
              <Card key={f.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <CardTitle className="text-base font-medium">{f.title}</CardTitle>
                      {f.description && (
                        <CardDescription className="mt-0.5">{f.description}</CardDescription>
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
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
