import { requireClientAccessBySlug, getCurrentUser } from '@/lib/dal/session'
import { prisma } from '@/lib/db'
import { CommentThread } from '@/components/comments/comment-thread'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Messages — ClientConnect' }

export default async function ClientMessagesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)
  const user = await getCurrentUser()
  if (!user?.client) return null

  // Show the client's basic info + thread.
  const client = await prisma.client.findUniqueOrThrow({
    where: { id: clientId },
    select: { companyName: true, contactName: true },
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Messages</h1>
        <p className="text-sm text-muted-foreground">
          Conversation with the {client.companyName} team.
        </p>
      </div>
      <Card>
        <CardContent className="p-4 max-w-3xl">
          <CommentThread clientId={clientId} />
        </CardContent>
      </Card>
    </div>
  )
}
