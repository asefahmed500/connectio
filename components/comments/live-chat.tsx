'use client'

import { useState, useEffect, useCallback } from 'react'
import { useChatPoll } from '@/hooks/use-chat-poll'
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

  useEffect(() => {
    async function init() {
      try {
        const params = new URLSearchParams({ clientId })
        if (submissionId) params.set('submissionId', submissionId)

        const [commentsRes, sessionRes] = await Promise.all([
          fetch(`/api/comments?${params}`, { credentials: 'same-origin' }),
          fetch('/api/auth/session', { credentials: 'same-origin' }),
        ])

        if (commentsRes.ok) {
          const data = (await commentsRes.json()) as CommentNode[]
          setInitialComments(data)
        }
        if (sessionRes.ok) {
          const session = await sessionRes.json()
          setViewerRole(session.role as UserRole)
          setViewerId(session.id)
        }
      } catch { /* ignore */ }
      setInitialLoading(false)
    }
    init()
  }, [clientId, submissionId])

  // De-duplicate: show initial comments, then append live ones
  const comments = (() => {
    const existingIds = new Set(initialComments.map((c) => c.id))
    const newOnes = liveComments.filter((c) => !existingIds.has(c.id))
    return [...initialComments, ...newOnes]
  })()

  if (initialLoading) {
    return (
      <div className="flex flex-col gap-2 py-6">
        <div className="h-4 w-2/3 bg-muted rounded animate-pulse" />
        <div className="h-3 w-full bg-muted rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
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
