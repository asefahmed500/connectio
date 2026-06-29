import { requireClientAccessBySlug } from '@/lib/dal/session'
import { LiveChat } from '@/components/comments/live-chat'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Messages — ClientConnect' }

export default async function ClientMessagesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Real-time conversation with your team.
        </p>
      </div>
      <Card>
        <CardContent className="p-4 max-w-3xl">
          <LiveChat clientId={clientId} />
        </CardContent>
      </Card>
    </div>
  )
}
