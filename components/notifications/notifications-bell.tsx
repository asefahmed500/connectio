'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useNotifications } from '@/hooks/use-notifications'

export function NotificationsBell({ enabled }: { enabled: boolean }) {
  const { unread, items, markAllRead } = useNotifications(enabled)
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          className="relative"
        >
          <Bell data-icon="inline-start" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] font-medium leading-none rounded-full min-w-4 h-4 px-1 grid place-items-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">
            Notifications {unread > 0 && <span className="text-muted-foreground">({unread})</span>}
          </span>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all read
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              You&apos;re all caught up.
            </li>
          ) : (
            items.slice(0, 10).map((n) => (
              <li
                key={n.id}
                className={`px-3 py-2 border-b last:border-0 ${
                  n.readAt ? '' : 'bg-primary/5'
                }`}
              >
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex flex-col gap-0.5 hover:bg-muted/40 -mx-3 -my-2 px-3 py-2"
                >
                  <div className="text-sm font-medium leading-tight">{n.title}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {new Date(n.createdAt).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
