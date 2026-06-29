'use client'

import { useEffect, useRef, useCallback } from 'react'
import type { CommentNode } from '@/lib/dal/comments'

const POLL_INTERVAL_MS = 3_000

export function useChatPoll(
  clientId: string,
  onNewComment: (c: CommentNode) => void,
  submissionId?: string,
) {
  const esRef = useRef<EventSource | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const failCountRef = useRef(0)
  const onNewRef = useRef(onNewComment)
  onNewRef.current = onNewComment

  useEffect(() => {
    if (!clientId) return

    let cancelled = false
    const params = new URLSearchParams({ clientId })
    if (submissionId) params.set('submissionId', submissionId)

    function startSSE() {
      if (cancelled) return
      const es = new EventSource(`/api/comments/stream?${params}`, { withCredentials: true })
      esRef.current = es

      es.onopen = () => {
        failCountRef.current = 0
      }

      es.onmessage = (e) => {
        try {
          const c = JSON.parse(e.data) as CommentNode
          onNewRef.current(c)
        } catch {
          // heartbeat
        }
      }

      es.onerror = () => {
        failCountRef.current += 1
        es.close()
        esRef.current = null
        if (failCountRef.current >= 3) {
          startPolling()
        }
      }
    }

    function startPolling() {
      if (pollRef.current) return
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/comments?${params}`, { credentials: 'same-origin' })
          if (res.ok) {
            const data = (await res.json()) as CommentNode[]
            for (const c of data) {
              onNewRef.current(c)
            }
          }
        } catch { /* ignore */ }
      }, POLL_INTERVAL_MS)
    }

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
  }, [clientId, submissionId])
}
