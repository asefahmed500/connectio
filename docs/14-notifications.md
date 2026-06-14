# 14 — Notifications

**Status:** Draft
**Channels:** In-app (real-time + persisted) · Email (digest + immediate) · *(future: SMS, push)*
**Transport:** Server-Sent Events over a Route Handler, with polling fallback. Pub/sub via Upstash Redis.
**Scope:** A complete notification system: who gets notified, when, how, and how it shows up in the UI.

## Goals

1. **In-app** — bell icon in the navbar, live-updating unread count, dropdown list, "mark all read" button.
2. **Real-time** — when something happens, the relevant users see it without refreshing the page.
3. **Role-aware** — every notification has an audience. Internal comments never reach the client. Submission notifications never reach an unassigned team member.
4. **Resumable** — if a user's connection drops, they don't lose notifications. SSE `Last-Event-ID` + a persisted `Notification` row per recipient handles this.
5. **Quietly degradable** — SSE blocked by a corporate proxy? Fall back to polling. Redis down? Persist + read on next poll. Email SMTP down? Retry via queue.

## Notification taxonomy

Every notification has a `type` from a closed enum. The type determines:
- **Audience** (who receives it)
- **Default channels** (in-app always; email if "important")
- **Link** (where clicking it takes you)
- **Template** (title + body strings)

### Event types and audiences

The recipient-routing rules below are authoritative. `notify()` (in code) is the only place they're encoded.

| Type | Trigger | Audience | Channels | Notes |
|------|---------|----------|----------|-------|
| `INVITE_CREATED` | Admin generates invite | (nobody — admin sees it in the invite list) | — | No push needed. |
| `INVITE_CONSUMED` | Client registers | The admin who created the invite + assigned team | in-app | "Your invite to Acme was accepted." |
| `INVITE_EXPIRED` | Lazy expiry sets status=EXPIRED | The admin who created it | in-app | Quiet. |
| `SUBMISSION_DRAFTED` | Client saves draft | (nobody) | — | Drafts are silent. |
| `SUBMISSION_SUBMITTED` | Client submits a form | All `SUPER_ADMIN` + team members **assigned to that client** | in-app + email | High-signal event. |
| `SUBMISSION_IN_REVIEW` | Admin/team starts review | The **client** | in-app | Tells them work is happening. |
| `SUBMISSION_CHANGES_REQUESTED` | Admin requests changes | The **client** | in-app + email | Action required. |
| `SUBMISSION_APPROVED` | Admin approves | The **client** | in-app + email | |
| `SUBMISSION_REJECTED` | Admin rejects | The **client** | in-app + email | |
| `COMMENT_POSTED_EXTERNAL` | Non-client posts a visible comment | The **client** | in-app + email (deduped per thread per hour) | |
| `COMMENT_POSTED_EXTERNAL_BY_CLIENT` | Client posts a comment | `SUPER_ADMIN` + assigned `TEAM_MEMBER` | in-app + email | |
| `COMMENT_POSTED_INTERNAL` | Team/admin posts internal comment | Other `SUPER_ADMIN` + assigned `TEAM_MEMBER` (excluding the author) | in-app only | **Never to client.** |
| `COMMENT_REPLY` | Anyone replies to a comment | The **parent comment's author** (if different from replier) | in-app + email | One-on-one ping. |
| `@MENTION` (future) | Author types `@name` | The mentioned user | in-app + email | v2; flag for moderation if mentions client in internal context. |
| `FILE_UPLOADED_CLIENT` | Client uploads | `SUPER_ADMIN` + assigned `TEAM_MEMBER` | in-app | |
| `FILE_UPLOADED_TEAM` | Admin/team uploads for a client | The **client** | in-app | |
| `FILE_DELETED` | Any user deletes a file | (nobody — audit log only) | — | Quiet. |
| `TEAM_MEMBER_ASSIGNED` | Admin assigns team to client | The team member + the client | in-app | Client just sees "X is your new contact." |
| `SYSTEM_ERROR` | DAL/sys-level error | `SUPER_ADMIN` | in-app + email | Used sparingly; see `11-error-handling-and-observability.md`. |

### Routing principles

1. **Authors don't notify themselves.** Always subtract the actor from the recipient set.
2. **Internal never leaks.** A comment with `isInternal=true` is invisible to clients at every layer — DAL filter, notification routing, email. This is asserted in unit tests for `notify()`.
3. **Assignment is the gate for team members.** A team member only hears about a client they're assigned to (via `TeamAssignment`). Super Admin bypasses.
4. **One notification per recipient per event.** No "12 people commented, here are 12 notifications" — those collapse (see *Digestion* below).
5. **Clients only ever see their own client's events.** Always. The `clientId` on the notification is the client *subject*, not the recipient; clients get filtered to where the subject is them.

## Data model

Add to the schema in `01-data-model.md`:

```prisma
model Notification {
  id            String           @id @default(cuid())
  recipientId   String           // → User.id
  recipient     User             @relation(fields: [recipientId], references: [id], onDelete: Cascade)
  type          NotificationType
  clientId      String?          // subject client (for deep-linking + scope)
  submissionId  String?          // optional context
  commentId     String?          // optional context
  title         String           // pre-rendered; safe to display directly
  body          String           // pre-rendered
  href          String           // path to navigate to on click
  payload       Json?            // raw event for debugging/auditing; not displayed
  readAt        DateTime?
  emailedAt     DateTime?        // set when email is sent; used for retry & dedupe
  createdAt     DateTime         @default(now())

  @@index([recipientId, readAt, createdAt])   // unread-first listing
  @@index([recipientId, createdAt])           // catch-up after offline
}

enum NotificationType {
  INVITE_CREATED
  INVITE_CONSUMED
  INVITE_EXPIRED
  SUBMISSION_DRAFTED
  SUBMISSION_SUBMITTED
  SUBMISSION_IN_REVIEW
  SUBMISSION_CHANGES_REQUESTED
  SUBMISSION_APPROVED
  SUBMISSION_REJECTED
  COMMENT_POSTED_EXTERNAL
  COMMENT_POSTED_EXTERNAL_BY_CLIENT
  COMMENT_POSTED_INTERNAL
  COMMENT_REPLY
  FILE_UPLOADED_CLIENT
  FILE_UPLOADED_TEAM
  TEAM_MEMBER_ASSIGNED
  SYSTEM_ERROR
}
```

Add to `User`:

```prisma
// add to User model
unreadNotifications   Int        @default(0)   // denormalized count for cheap badge reads
lastNotificationSeenAt DateTime?
```

**Why pre-rendered `title` and `body`?** Names change, forms get renamed, slugs move. If we stored `{ messageId, params }` and rendered at read time, an old notification might render as "undefined mentioned you on undefined." Pre-rendering freezes the message as it was at event time — what the user saw is what they get forever.

`payload` is kept for diagnostics: it's the raw event that triggered the notification, never displayed.

## Delivery pipeline

```
                 ┌──────────────────────────────────┐
                 │  Domain event (Server Action,    │
                 │  route handler, cron)            │
                 └────────────────┬─────────────────┘
                                  │  calls
                                  ▼
                 ┌──────────────────────────────────┐
                 │  lib/notifications/notify(event) │
                 │  - pure: computes recipient set  │
                 │  - applies role/visibility rules │
                 └────────────────┬─────────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │  for each recipient:           │
                  ▼                                ▼
   ┌───────────────────────────┐   ┌─────────────────────────────────┐
   │ INSERT Notification row   │   │ Publish to Redis channel        │
   │ UPDATE User.unread +1     │   │   "notify:<recipientId>"        │
   │ (in same tx)              │   │                                 │
   └─────────────┬─────────────┘   └────────────┬────────────────────┘
                 │                              │
                 │ after()                      │ subscriber
                 ▼                              ▼
   ┌───────────────────────────┐   ┌─────────────────────────────────┐
   │ Email queue (QStash or    │   │ SSE endpoint (/api/notifications│
   │ simple "send + retry")    │   │   /stream) receives the message │
   │ — only if type defaults   │   │ and pushes to that user's       │
   │   to email OR user opted  │   │ EventSource connection          │
   │   in.                     │   │                                 │
   └───────────────────────────┘   └─────────────────────────────────┘
```

### `notify(event)` — the single entry point

```ts
// lib/notifications/notify.ts
import 'server-only'
import { prisma } from '@/lib/db'
import { redis } from '@/lib/redis'
import { renderTemplate } from './templates'
import type { NotificationType } from '@prisma/client'

/**
 * The shape every notification event carries. Discriminated union
 * enforces that callers provide the right context per type.
 */
export type NotificationEvent =
  | { type: 'SUBMISSION_SUBMITTED'; actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'SUBMISSION_APPROVED';  actorId: string; clientId: string; submissionId: string; formTitle: string }
  | { type: 'COMMENT_POSTED_EXTERNAL'; actorId: string; clientId: string; commentId: string; submissionId?: string; messagePreview: string }
  | { type: 'COMMENT_POSTED_INTERNAL'; actorId: string; clientId: string; commentId: string; submissionId?: string; messagePreview: string }
  | { type: 'COMMENT_REPLY'; actorId: string; clientId: string; commentId: string; parentAuthorId: string; messagePreview: string }
  // ... etc, one per NotificationType

export async function notify(event: NotificationEvent): Promise<void> {
  const recipientIds = await computeRecipients(event)
  if (recipientIds.length === 0) return

  const tpl = renderTemplate(event)

  // One tx: write all notifications + bump unread counts.
  await prisma.$transaction(async (tx) => {
    await tx.notification.createMany({
      data: recipientIds.map(rId => ({
        recipientId: rId,
        type: event.type,
        clientId: 'clientId' in event ? event.clientId : null,
        submissionId: 'submissionId' in event ? event.submissionId ?? null : null,
        commentId: 'commentId' in event ? event.commentId : null,
        title: tpl.title,
        body: tpl.body,
        href: tpl.href,
        payload: event as unknown as object,
      })),
    })
    await tx.user.updateMany({
      where: { id: { in: recipientIds } },
      data: { unreadNotifications: { increment: 1 } },
    })
  })

  // Push to realtime (fire-and-forget; persistence is already durable).
  if (redis) {
    await Promise.all(recipientIds.map(rId => redis.publish(`notify:${rId}`, JSON.stringify({ type: event.type }))))
  }

  // Email side-channel (non-blocking).
  if (tpl.emailByDefault) {
    afterEmail(event, recipientIds)
  }
}
```

### `computeRecipients(event)` — where the role rules live

```ts
// lib/notifications/audience.ts
import 'server-only'
import { prisma } from '@/lib/db'

export async function computeRecipients(event: NotificationEvent): Promise<string[]> {
  switch (event.type) {
    case 'SUBMISSION_SUBMITTED': {
      const [admins, assigned] = await Promise.all([
        prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } }),
        prisma.teamAssignment.findMany({
          where: { clientId: event.clientId },
          include: { teamMember: { select: { userId: true } } },
        }),
      ])
      return uniq([
        ...admins.map(a => a.id),
        ...assigned.map(a => a.teamMember.userId),
      ].filter(id => id !== event.actorId))
    }

    case 'SUBMISSION_APPROVED':
    case 'SUBMISSION_REJECTED':
    case 'SUBMISSION_CHANGES_REQUESTED':
    case 'SUBMISSION_IN_REVIEW': {
      // Notify the client. Client's userId is on the Client row.
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: event.clientId },
        select: { userId: true },
      })
      return client.userId === event.actorId ? [] : [client.userId]
    }

    case 'COMMENT_POSTED_EXTERNAL': {
      // External comment by team/admin → notify the client
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: event.clientId },
        select: { userId: true },
      })
      return client.userId === event.actorId ? [] : [client.userId]
    }

    case 'COMMENT_POSTED_EXTERNAL_BY_CLIENT': {
      // Comment by client → notify admins + assigned team (excluding actor)
      const [admins, assigned] = await Promise.all([
        prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } }),
        prisma.teamAssignment.findMany({
          where: { clientId: event.clientId },
          include: { teamMember: { select: { userId: true } } },
        }),
      ])
      return uniq([
        ...admins.map(a => a.id),
        ...assigned.map(a => a.teamMember.userId),
      ].filter(id => id !== event.actorId))
    }

    case 'COMMENT_POSTED_INTERNAL': {
      // Internal comment → admins + assigned team (excluding actor).
      // Client is NEVER in this list. No DB lookup for the client's userId.
      const [admins, assigned] = await Promise.all([
        prisma.user.findMany({ where: { role: 'SUPER_ADMIN' }, select: { id: true } }),
        prisma.teamAssignment.findMany({
          where: { clientId: event.clientId },
          include: { teamMember: { select: { userId: true } } },
        }),
      ])
      return uniq([
        ...admins.map(a => a.id),
        ...assigned.map(a => a.teamMember.userId),
      ].filter(id => id !== event.actorId))
    }

    case 'COMMENT_REPLY': {
      return event.parentAuthorId === event.actorId ? [] : [event.parentAuthorId]
    }

    case 'FILE_UPLOADED_CLIENT': {
      return listAdminAndAssignedTeam(event.clientId, event.actorId)
    }

    case 'FILE_UPLOADED_TEAM': {
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: event.clientId },
        select: { userId: true },
      })
      return client.userId === event.actorId ? [] : [client.userId]
    }

    // ... etc
  }
}
```

**This file is the security boundary for visibility.** A bug here leaks information. Unit tests assert:
- For every `INTERNAL` event type, no client receives it.
- For every type, the actor is excluded.
- For every client-scoped event, unassigned team members are excluded.

## Real-time transport: SSE

### Why SSE over WebSocket

- Vercel serverless doesn't natively support long-lived WebSockets. You'd need Pusher/Ably or a separate service.
- SSE is HTTP — works with any CDN, proxies, no protocol upgrade.
- EventSource (browser API) auto-reconnects with `Last-Event-ID`, which is exactly what we need for resumability.
- One-way (server → client) is sufficient for notifications.

### Endpoint

```ts
// app/api/notifications/stream/route.ts
import { NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { requireSession } from '@/lib/dal/session'
import { redis } from '@/lib/redis'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const claims = await requireSession()

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const send = (data: string, id?: string) => {
        if (id) controller.enqueue(enc.encode(`id: ${id}\n`))
        controller.enqueue(enc.encode(`data: ${data}\n\n`))
      }

      // 1. Replay missed notifications since Last-Event-ID (or last seen).
      const lastId = req.headers.get('last-event-id')
      const since = lastId ?? claims.sub /* fallback handled below */
      const replayed = await prisma.notification.findMany({
        where: { recipientId: claims.sub, createdAt: { $gt: new Date(Number(lastId) || 0) } },
        orderBy: { createdAt: 'asc' },
        take: 50,
      })
      replayed.forEach(n => send(JSON.stringify({ id: n.id, type: n.type, title: n.title, body: n.body, href: n.href }), n.createdAt.getTime().toString()))

      // 2. Subscribe to live notifications.
      const channel = `notify:${claims.sub}`
      const unsub = await redis.subscribe(channel, (msg) => {
        send(msg, Date.now().toString())
      })

      // 3. Heartbeat every 25s to keep the connection alive and detect dead clients.
      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`: ping\n\n`)) } catch {}
      }, 25_000)

      // 4. Cleanup on cancel (client disconnects).
      req.signal.addEventListener('abort', () => {
        clearInterval(heartbeat)
        unsub()
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',   // disable proxy buffering (Nginx, etc.)
    },
  })
}
```

### Vercel considerations

- **Timeout:** Vercel's default function timeout on Pro is 60s; Fluid Compute allows longer. Set explicit timeout in `vercel.json`:
  ```json
  { "functions": { "app/api/notifications/stream/route.ts": { "maxDuration": 300 } } }
  ```
  When the function exits, EventSource reconnects automatically.
- **Cold starts:** keep the handler lightweight — the auth + subscribe path should be < 100ms.
- **Concurrent connections:** Vercel scales function instances; one instance can hold many SSE connections. With Fluid Compute, an instance can serve thousands of long-lived connections.

### Browser hook

```ts
// hooks/use-notifications.ts
'use client'
import { useEffect, useState } from 'react'

export function useNotifications(recipientId: string) {
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState<Notification[]>([])

  useEffect(() => {
    // Initial fetch of unread count + recent items.
    fetch('/api/notifications').then(r => r.json()).then(d => {
      setUnread(d.unread)
      setItems(d.items)
    })

    // SSE for live updates.
    const es = new EventSource('/api/notifications/stream', { withCredentials: true })
    es.onmessage = (e) => {
      const n = JSON.parse(e.data) as Notification
      setItems(prev => [n, ...prev].slice(0, 50))
      setUnread(u => u + 1)
    }
    es.onerror = () => { es.close() /* EventSource auto-retries */ }

    return () => es.close()
  }, [recipientId])

  return { unread, items }
}
```

### Polling fallback

If SSE isn't available (proxy blocks `text/event-stream`, or the user is on an old browser), fall back to 30-second polling of `GET /api/notifications?since=<timestamp>`.

The provider detects failures:

```ts
const es = new EventSource('/api/notifications/stream')
let fails = 0
es.onerror = () => {
  fails += 1
  if (fails >= 3) {
    es.close()
    startPolling()           // fall back
  }
  // EventSource itself retries up to its built-in limit
}
```

## Email side-channel

Emails are sent via `after()` so they don't block the response.

```ts
// lib/notifications/email.ts
import 'server-only'
import { after } from 'next/server'
import { sendNotificationEmail } from '@/lib/email'
import { prisma } from '@/lib/db'

export function afterEmail(event: NotificationEvent, recipientIds: string[]) {
  after(async () => {
    const recipients = await prisma.user.findMany({
      where: { id: { in: recipientIds } },
      select: { id: true, email: true, name: true },
    })

    for (const r of recipients) {
      // Dedupe: don't email the same notification type+clientId twice within an hour.
      const recent = await prisma.notification.findFirst({
        where: {
          recipientId: r.id,
          type: event.type,
          clientId: 'clientId' in event ? event.clientId : null,
          emailedAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
      })
      if (recent) continue

      await sendNotificationEmail({
        to: r.email,
        name: r.name,
        subject: renderTemplate(event).title,
        preview: renderTemplate(event).body.slice(0, 140),
        ctaHref: renderTemplate(event).href,
      })

      await prisma.notification.updateMany({
        where: { recipientId: r.id, type: event.type, emailedAt: null },
        data: { emailedAt: new Date() },
      })
    }
  })
}
```

### Digest mode (future)

Phase 2: instead of immediate email per event, batch into a daily digest for users who opt in. Stored preference `User.notificationEmailMode: 'IMMEDIATE' | 'DAILY_DIGEST' | 'OFF'`. Cron job sends digests at 9am user-local-time (best-effort — global app means we approximate by timezone in `User.timezone`).

## UI components

### `NotificationsBell`

In the top bar of every authenticated layout. Shows the unread count badge. Clicking opens a dropdown.

```tsx
// components/notifications/notifications-bell.tsx
'use client'
import { useNotifications } from '@/hooks/use-notifications'

export function NotificationsBell({ recipientId }: { recipientId: string }) {
  const { unread, items, markAllRead } = useNotifications(recipientId)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications">
          <BellIcon />
          {unread > 0 && <Badge>{unread > 99 ? '99+' : unread}</Badge>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex justify-between px-3 py-2">
          <span className="font-medium">Notifications</span>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-muted-foreground">
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>
        )}
        {items.map(n => <NotificationRow key={n.id} n={n} />)}
        <DropdownMenuSeparator />
        <Link href="/notifications" className="block px-3 py-2 text-sm text-center">
          See all
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### `/notifications` page

Full list, filterable by type. Marks notifications as read when scrolled into view (via `IntersectionObserver`). Server-rendered for SEO/initial paint, hydrated for real-time.

### Read state mutations

- `POST /api/notifications/[id]/read` — Server Action `markAsRead(id)` updates `readAt` and decrements `User.unreadNotifications` (atomic, with `unreadNotifications` floor at 0).
- `POST /api/notifications/read-all` — bulk mark-as-read.

## Templates

```ts
// lib/notifications/templates.ts
import 'server-only'
import type { NotificationEvent } from './notify'

type Template = { title: string; body: string; href: string; emailByDefault: boolean }

export function renderTemplate(event: NotificationEvent): Template {
  switch (event.type) {
    case 'SUBMISSION_SUBMITTED':
      return {
        title: `New submission from ${/* client companyName */ ''}`,
        body: `${event.formTitle} was submitted for review.`,
        href: `/admin/clients/${event.clientId}/submissions/${event.submissionId}`,
        emailByDefault: true,
      }
    case 'SUBMISSION_APPROVED':
      return {
        title: 'Your submission was approved',
        body: `${event.formTitle} has been approved.`,
        href: `/dashboard/visitor/<slug>/submissions/${event.submissionId}`,
        emailByDefault: true,
      }
    case 'COMMENT_POSTED_INTERNAL':
      return {
        title: 'New internal note',
        body: event.messagePreview,
        href: `/admin/clients/${event.clientId}#comment-${event.commentId}`,
        emailByDefault: false,   // never email internal
      }
    // ...
  }
}
```

Templates are pure functions of the event. No DB lookups. Strings are pre-rendered and stored.

## Open questions

- **Mentions.** Parse `@<email>` in comments. Resolve to user; emit `@MENTION` event. Needs to handle: mention of someone not on the project (drop), mention in an internal comment by a team member (notify only team/admin roles).
- **Mobile push.** v2. Via Firebase or APNs directly. Requires a service worker; doable but a project.
- **Quiet hours.** Per-user "do not email between 22:00–07:00 local." Easy to add once `User.timezone` exists.
- **Notification preferences UI.** v2 — let users mute specific types.

## Operational

- **Backpressure:** if `notify()` gets called in a hot loop (e.g. a webhook bursts in 100 comments), the `createMany` + Redis publish path is the bottleneck. Mitigation: batch within a small window (50ms) before publishing.
- **Retention:** nightly cron deletes notifications older than 90 days. Audit log keeps the accountability trail separately.
- **Failure modes:**
  - DB write fails → notification not delivered; log loudly (user missed something).
  - Redis publish fails → in-app notification is persisted, only real-time push fails. Client picks it up on next reconnect/poll.
  - Email send fails → retried up to 3 times with exponential backoff. After that, the in-app notification still stands.
