'use client'

import { useEffect, useRef, useState } from 'react'
import type { NotificationDTO } from '@/lib/notifications/types'

type State = {
  unread: number
  items: NotificationDTO[]
}

const POLL_INTERVAL_MS = 30_000

/**
 * Subscribes to the user's notifications. Tries SSE first; falls back to
 * polling if SSE fails repeatedly. Marks items as read on demand.
 */
export function useNotifications(enabled: boolean) {
  const [state, setState] = useState<State>({ unread: 0, items: [] })
  const [connected, setConnected] = useState(false)
  const esRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const failCountRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let cancelled = false

    async function bootstrap() {
      try {
        const res = await fetch('/api/notifications', { credentials: 'same-origin' })
        if (!res.ok) return
        const data = (await res.json()) as State
        if (!cancelled) setState(data)
      } catch {
        // Network glitch — SSE/poll will recover.
      }
    }

    function startSSE() {
      if (cancelled) return
      const es = new EventSource('/api/notifications/stream', { withCredentials: true })
      esRef.current = es

      es.onopen = () => {
        failCountRef.current = 0
        setConnected(true)
      }

      es.onmessage = (e) => {
        try {
          const n = JSON.parse(e.data) as NotificationDTO
          setState((prev) => {
            if (prev.items.some((x) => x.id === n.id)) return prev
            return {
              unread: prev.unread + (n.readAt ? 0 : 1),
              items: [n, ...prev.items].slice(0, 50),
            }
          })
        } catch {
          // Ignore malformed payloads (likely heartbeat comments).
        }
      }

      es.onerror = () => {
        setConnected(false)
        failCountRef.current += 1
        es.close()
        esRef.current = null

        if (failCountRef.current >= 3) {
          // Fall back to polling — corporate proxies often block SSE.
          startPolling()
        } else {
          // EventSource retries internally; nothing to do here.
        }
      }
    }

    function startPolling() {
      if (pollRef.current) return
      pollRef.current = setInterval(bootstrap, POLL_INTERVAL_MS)
    }

    bootstrap()
    startSSE()

    return () => {
      cancelled = true
      esRef.current?.close()
      esRef.current = null
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [enabled])

  async function markRead(id: string) {
    setState((prev) => ({
      ...prev,
      unread: Math.max(0, prev.unread - 1),
      items: prev.items.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
    }))
    try {
      await fetch(`/api/notifications/${id}/read`, {
        method: 'POST',
        credentials: 'same-origin',
      })
    } catch {
      // optimistic UI already updated; next poll will reconcile
    }
  }

  async function markAllRead() {
    setState((prev) => ({
      unread: 0,
      items: prev.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
    }))
    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        credentials: 'same-origin',
      })
    } catch {
      // reconciliation on next poll
    }
  }

  return { ...state, connected, markRead, markAllRead }
}
