# 06 — Comments

**Status:** Draft
**Models:** `Comment`
**Visibility flag:** `Comment.isInternal` (default `false`)

Comments are threaded feedback attached to a Client, optionally pinned to a specific Submission. They're the primary channel between the admin team and the client.

## Visibility matrix

| Author role | Default `isInternal` | Can post internal? | Can read internal? |
|-------------|:---:|:---:|:---:|
| `SUPER_ADMIN` | false | ✓ | ✓ |
| `TEAM_MEMBER` | false | ✓ | ✓ |
| `CLIENT` | false (always) | — | — |

Clients never see `isInternal = true` comments. The DAL filters on read; the DB doesn't lie.

## Threading

- Top-level comment: `parentId = null`.
- Reply: `parentId = <parent id>`.
- Max depth: **2 levels**. A reply to a reply is flattened: `parentId` always points to the *top-level* comment, not to the reply. (Deeper threading gets messy in UI; if we need it later, lift this limit.)

```ts
// Tree shape returned by the DAL
type CommentTreeNode = {
  id: string
  author: { id: string; name: string; role: UserRole }
  message: string
  isInternal: boolean
  createdAt: string   // ISO string for client serialization
  replies: CommentTreeNode[]
}
```

## Write path

```ts
// app/(admin)/clients/[id]/actions.ts (excerpt)
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { prisma } from '@/lib/db'
import { requireClientAccess } from '@/lib/dal/session'
import { notifyCommentPosted } from '@/lib/notifications'

const Schema = z.object({
  clientId: z.string().cuid(),
  submissionId: z.string().cuid().optional(),
  parentId: z.string().cuid().optional(),
  message: z.string().trim().min(1).max(5000),
  isInternal: z.boolean().optional(),
})

export async function postCommentAction(prevState: unknown, formData: FormData) {
  const parsed = Schema.safeParse({
    clientId: formData.get('clientId'),
    submissionId: formData.get('submissionId') || undefined,
    parentId: formData.get('parentId') || undefined,
    message: formData.get('message'),
    isInternal: formData.get('isInternal') === 'true',
  })
  if (!parsed.success) return { error: 'Invalid input' }

  const claims = await requireClientAccess(parsed.data.clientId)

  // Client cannot post internal comments. Strip the flag.
  const isInternal = claims.role === 'CLIENT' ? false : parsed.data.isInternal ?? false

  // Validate parent + submission belong to this client.
  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parsed.data.parentId } })
    if (!parent || parent.clientId !== parsed.data.clientId) {
      return { error: 'Invalid parent comment' }
    }
  }
  if (parsed.data.submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: parsed.data.submissionId } })
    if (!sub || sub.clientId !== parsed.data.clientId) {
      return { error: 'Invalid submission' }
    }
  }

  const comment = await prisma.comment.create({
    data: {
      clientId: parsed.data.clientId,
      authorId: claims.sub,
      submissionId: parsed.data.submissionId ?? null,
      parentId: parsed.data.parentId ?? null,
      message: parsed.data.message,
      isInternal,
    },
    include: { author: { select: { id: true, name: true, role: true } } },
  })

  after(async () => {
    // Only notify on external comments. Internal = team-only.
    if (!isInternal) {
      await notifyCommentPosted({ comment })
    }
  })

  revalidatePath(`/admin/clients/${parsed.data.clientId}`)
  return { success: true, comment }
}
```

Key points:
- **`requireClientAccess` is the gate.** All three roles pass through it; the role of the *viewer* decides what they can do once inside.
- **Client cannot set `isInternal`.** Even if they craft a request with `isInternal=true`, the action forces it to `false`.
- **Parent/submission ownership is re-checked** against `clientId`. Don't trust IDs from the client.
- **Notification fires via `after()`** so the response isn't blocked on email.

## Read path

```ts
// lib/dal/comments.ts
import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireClientAccess, getSession } from '@/lib/dal/session'

export const getCommentsDTO = cache(async (clientId: string, submissionId?: string) => {
  const claims = await requireClientAccess(clientId)

  const rows = await prisma.comment.findMany({
    where: {
      clientId,
      submissionId: submissionId ?? null,
      // Clients never see internal comments.
      ...(claims.role === 'CLIENT' ? { isInternal: false } : {}),
    },
    include: { author: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  })

  // Treeify: top-level + replies (flat-under-parent per the depth-2 rule)
  const top = rows.filter(r => r.parentId === null)
  return top.map(parent => ({
    id: parent.id,
    author: parent.author,
    message: parent.message,
    isInternal: parent.isInternal,
    createdAt: parent.createdAt.toISOString(),
    replies: rows
      .filter(r => r.parentId === parent.id)
      .map(r => ({ /* same shape */ })),
  }))
})
```

The `(clientId, createdAt)` compound index on `Comment` makes the `findMany` cheap even at hundreds of comments per client.

## Edit and delete

- **Edit:** author only, within 24h of `createdAt`. Updates `message` and bumps `updatedAt`. Audit logged.
- **Delete:** author or `SUPER_ADMIN`. Soft-delete is intentionally not implemented — `onDelete: Cascade` removes the row and its replies. We rely on the audit log for a trail.

## Notifications

`notifyCommentPosted(comment)` triggers an email to:
- The **client** (their contact email) when the author is `TEAM_MEMBER` or `SUPER_ADMIN`.
- The **assigned team members + admin** when the author is `CLIENT`.

Email content: author name, message preview (first 280 chars), deep link to the comment thread.

Notifications are deduped per-recipient per-hour per-thread to avoid spamming.

## Open questions

- **@mentions.** Not in v1. Could be added by parsing `@<email>` in `message` and notifying matched users.
- **Real-time updates.** Out of scope (would need WebSocket / SSE; Phase 3).
- **Reactions / emoji.** Out of scope.
