'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Trash2, Search, X, Bell, CheckCheck } from 'lucide-react'
import type { NotificationDTO } from '@/lib/notifications/types'
import { cn } from '@/lib/utils'

const TYPES = [
  'INVITE_CREATED', 'INVITE_CONSUMED', 'INVITE_EXPIRED',
  'SUBMISSION_SUBMITTED', 'SUBMISSION_IN_REVIEW', 'SUBMISSION_CHANGES_REQUESTED',
  'SUBMISSION_APPROVED', 'SUBMISSION_REJECTED',
  'COMMENT_POSTED_EXTERNAL', 'COMMENT_POSTED_EXTERNAL_BY_CLIENT',
  'COMMENT_POSTED_INTERNAL', 'COMMENT_REPLY',
  'FILE_UPLOADED_CLIENT', 'FILE_UPLOADED_TEAM',
  'TEAM_MEMBER_ASSIGNED',
] as const

function typeLabel(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export function NotificationsPage() {
  const [items, setItems] = useState<NotificationDTO[]>([])
  const [unread, setUnread] = useState(0)
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [type, setType] = useState('all')
  const [read, setRead] = useState('all')
  const [loading, setLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const router = useRouter()

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(debounceRef.current)
  }, [q])

  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedQ) params.set('q', debouncedQ)
    if (type !== 'all') params.set('type', type)
    if (read !== 'all') params.set('read', read)

    let cancelled = false
    fetch(`/api/notifications?${params}`, { credentials: 'same-origin' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data) {
          setItems(data.items ?? [])
          setUnread(data.unread ?? 0)
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [debouncedQ, type, read])

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((n) => n.id !== id))
    await fetch(`/api/notifications/${id}`, { method: 'DELETE', credentials: 'same-origin' })
  }

  async function handleDeleteAll() {
    setItems([])
    setUnread(0)
    await fetch('/api/notifications', { method: 'DELETE', credentials: 'same-origin' })
  }

  async function handleMarkRead(id: string) {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    setUnread((prev) => Math.max(0, prev - 1))
    await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'same-origin' })
  }

  async function handleMarkAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    setUnread(0)
    await fetch('/api/notifications/read-all', { method: 'POST', credentials: 'same-origin' })
  }

  const hasFilters = debouncedQ !== '' || type !== 'all' || read !== 'all'

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading tracking-wide">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex gap-2">
          {items.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck data-icon="inline-start" />
                Mark all read
              </Button>
              <Button variant="outline" size="sm" onClick={handleDeleteAll}>
                <X data-icon="inline-start" />
                Clear all
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex-1 min-w-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search notifications…"
                  className="pl-8"
                  aria-label="Search notifications"
                />
              </div>
            </div>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-full sm:w-[170px]">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{typeLabel(t)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={read} onValueChange={setRead}>
              <SelectTrigger className="w-full sm:w-[130px]">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setQ(''); setType('all'); setRead('all') }}
              >
                <X data-icon="inline-start" className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && items.length === 0 && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 flex flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center flex flex-col items-center gap-3">
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            {hasFilters ? (
              <>
                <p className="text-sm text-muted-foreground">No notifications match your filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setQ(''); setType('all'); setRead('all') }}
                >
                  Clear filters
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
            )}
          </CardContent>
        </Card>
      )}

      {items.map((n) => (
        <Card
          key={n.id}
          tabIndex={0}
          role="button"
          aria-label={`${n.title} — ${n.readAt ? 'read' : 'unread'}`}
          className={cn(
            'cursor-pointer transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            !n.readAt && 'border-primary/30 bg-primary/5 hover:bg-primary/10',
          )}
          onClick={() => { handleMarkRead(n.id); router.push(n.href) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleMarkRead(n.id)
              router.push(n.href)
            }
          }}
        >
          <CardContent className="flex items-start justify-between gap-4 p-4">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{n.title}</span>
                <Badge variant="secondary" className="text-[10px] shrink-0">{typeLabel(n.type)}</Badge>
                {!n.readAt && <Badge variant="default" className="text-[10px] shrink-0">New</Badge>}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">{n.body}</p>
              <span className="text-xs text-muted-foreground/60">
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Delete notification"
              onClick={(e) => { e.stopPropagation(); handleDelete(n.id) }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
