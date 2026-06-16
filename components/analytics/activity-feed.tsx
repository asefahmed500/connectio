import Link from 'next/link'
import { FileText, MessageSquare, Paperclip } from 'lucide-react'
import type { ActivityItem } from '@/lib/dal/analytics'
import { Badge } from '@/components/ui/badge'

export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No activity yet. Once clients start submitting, you&apos;ll see it here.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, idx) => (
        <li key={`${item.kind}-${idx}`} className="flex gap-3 text-sm">
          <div className="mt-0.5 shrink-0">
            <Icon kind={item.kind} />
          </div>
          <div className="min-w-0 flex-1">
            <Link href={item.href} className="hover:underline">
              <ActivityText item={item} />
            </Link>
            <div className="text-xs text-muted-foreground">
              {item.clientName} · {timeAgo(item.at)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Icon({ kind }: { kind: ActivityItem['kind'] }) {
  const cls = 'size-4 text-muted-foreground'
  if (kind === 'submission') return <FileText className={cls} />
  if (kind === 'comment') return <MessageSquare className={cls} />
  return <Paperclip className={cls} />
}

function ActivityText({ item }: { item: ActivityItem }) {
  if (item.kind === 'submission') {
    return (
      <span>
        <strong>{item.clientName}</strong>{' '}
        {item.submissionStatus === 'SUBMITTED'
          ? 'submitted'
          : item.submissionStatus === 'APPROVED'
            ? 'got approval on'
            : item.submissionStatus === 'REJECTED'
              ? 'got rejection on'
              : item.submissionStatus === 'CHANGES_REQUESTED'
                ? 'was asked to revise'
                : 'updated'}
        {' '}
        <em>{item.formTitle}</em>
      </span>
    )
  }
  if (item.kind === 'comment') {
    return (
      <span>
        <strong>{item.authorName}</strong>{' '}
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {item.authorRole?.replace('_', ' ')}
        </span>
        {item.isInternal && (
          <Badge variant="outline" className="ml-1">internal</Badge>
        )}
        : &ldquo;{item.messagePreview}&rdquo;
      </span>
    )
  }
  return (
    <span>
      <strong>{item.clientName}</strong> uploaded <em>{item.fileName}</em>
    </span>
  )
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = now - then
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(iso).toLocaleDateString()
}
