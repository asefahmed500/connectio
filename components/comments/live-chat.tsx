'use client'

import { useState, useEffect, useCallback } from 'react'
import { useChatPoll } from '@/hooks/use-chat-poll'
import { Button } from '@/components/ui/button'
import { CommentForm } from './comment-form'
import { CommentList } from './comment-list'
import type { CommentNode } from '@/lib/dal/comments'
import type { UserRole } from '@prisma/client'

export function LiveChat({
  clientId,
  submissionId,
}: {
  clientId: string
  submissionId?: string
}) {
  const [initialComments, setInitialComments] = useState<CommentNode[]>([])
  const [liveComments, setLiveComments] = useState<CommentNode[]>([])
  const [viewerRole, setViewerRole] = useState<UserRole | null>(null)
  const [viewerId, setViewerId] = useState<string>('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const handleNewComment = useCallback((c: CommentNode) => {
    setLiveComments((prev) => {
      if (prev.some((x) => x.id === c.id)) return prev
      return [...prev, c]
    })
  }, [])

  const handleDelete = useCallback((id: string) => {
    setInitialComments((prev) =>
      prev
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) }))
    )
    setLiveComments((prev) =>
      prev
        .filter((c) => c.id !== id)
        .map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== id) }))
    )
  }, [])

  useChatPoll(clientId, handleNewComment, submissionId)

  // Initial load + session fetch. setState calls happen only after the awaited
  // fetches, never synchronously in the effect body — keeps the
  // `react-hooks/set-state-in-effect` rule happy.
  const loadInitial = useCallback(async () => {
    try {
      const params = new URLSearchParams({ clientId })
      if (submissionId) params.set('submissionId', submissionId)

      const [commentsRes, sessionRes] = await Promise.all([
        fetch(`/api/comments?${params}`, { credentials: 'same-origin' }),
        fetch('/api/auth/session', { credentials: 'same-origin' }),
      ])

      if (!commentsRes.ok || !sessionRes.ok) {
        throw new Error('Network response was not ok')
      }

      const data = (await commentsRes.json()) as CommentNode[]
      setInitialComments(data)
      const session = await sessionRes.json()
      setViewerRole(session.role as UserRole)
      setViewerId(session.id)
      setLoadError(false)
    } catch (err) {
      console.error('[live-chat] initial load failed:', err)
      setLoadError(true)
    } finally {
      setInitialLoading(false)
    }
  }, [clientId, submissionId])

  useEffect(() => {
    // setState calls inside loadInitial all happen after the awaited fetches
    // (in the .then/.catch/finally paths), so they cannot trigger a cascading
    // render. The rule's static analysis can't see across the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadInitial()
  }, [loadInitial])

  // Retry handler lives in the render body, so its setState calls are NOT in
  // an effect — the cascading-render rule doesn't apply.
  const retry = () => {
    setInitialLoading(true)
    loadInitial()
  }

  // De-duplicate: show initial comments, then append live ones
  const comments = (() => {
    const existingIds = new Set(initialComments.map((c) => c.id))
    const newOnes = liveComments.filter((c) => !existingIds.has(c.id))
    return [...initialComments, ...newOnes]
  })()

  if (initialLoading) {
    return (
      <div className="flex flex-col gap-2 py-6" role="status" aria-label="Loading messages">
        <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
      </div>
    )
  }
  if (loadError) {
    return (
      <div className="py-6 text-center flex flex-col items-center gap-3">
        <p className="text-sm text-muted-foreground" role="alert">
          Couldn&apos;t load messages.
        </p>
        <Button variant="outline" size="sm" onClick={retry}>
          Retry
        </Button>
      </div>
    )
  }
  if (!viewerRole) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm text-muted-foreground">Please log in to view messages.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CommentList
        comments={comments}
        viewerRole={viewerRole}
        viewerId={viewerId}
        clientId={clientId}
        onDelete={handleDelete}
      />
      <CommentForm
        clientId={clientId}
        submissionId={submissionId}
        viewerRole={viewerRole}
      />
    </div>
  )
}
