'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, User, Building2, FileText, Loader2 } from 'lucide-react'

type Result = {
  users: Array<{
    id: string
    name: string
    email: string
    role: string
  }>
    clients: Array<{
      id: string
      companyName: string
      contactName: string
      uniqueSlug: string
    }>
    submissions: Array<{
      id: string
      status: string
      formId: string
      formTitle: string
      clientId: string
      clientName: string
      clientSlug: string
      createdAt: string
    }>
}

export default function SearchPage() {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setResult(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`)
      if (res.ok) setResult(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(q), 300)
    return () => clearTimeout(timer)
  }, [q, search])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Search</h1>
        <p className="text-sm text-muted-foreground">
          Search across users, clients, and submissions.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name, email, company…"
          className="pl-9 text-lg h-12"
          autoFocus
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {result && (
        <div className="flex flex-col gap-6">
          {result.users.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" data-icon="inline-start" />
                Users
              </div>
              {result.users.map((u) => (
                <Card
                  key={u.id}
                  className="cursor-pointer hover:bg-muted/50"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open user ${u.name}`}
                  onClick={() => router.push(`/admin/users/${u.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/admin/users/${u.id}`)
                    }
                  }}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </div>
                    <Badge variant="outline">{u.role}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.clients.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Building2 className="h-4 w-4" data-icon="inline-start" />
                Clients
              </div>
              {result.clients.map((c) => (
                <Card
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open client ${c.companyName}`}
                  onClick={() => router.push(`/admin/clients/${c.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(`/admin/clients/${c.id}`)
                    }
                  }}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{c.companyName}</span>
                      <span className="text-xs text-muted-foreground">{c.contactName} · /{c.uniqueSlug}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.submissions.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4" data-icon="inline-start" />
                Submissions
              </div>
              {result.submissions.map((s) => (
                <Card
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/50"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open client ${s.clientName}`}
                  onClick={() => router.push(s.clientId ? `/admin/clients/${s.clientId}` : '/admin/clients')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      router.push(s.clientId ? `/admin/clients/${s.clientId}` : '/admin/clients')
                    }
                  }}
                >
                  <CardContent className="p-3 flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{s.clientName}</span>
                      <span className="text-xs text-muted-foreground">{s.formTitle} · {new Date(s.createdAt).toLocaleDateString()}</span>
                    </div>
                    <Badge variant="outline">{s.status}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {result.users.length === 0 && result.clients.length === 0 && result.submissions.length === 0 && (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No results found for &ldquo;{q}&rdquo;.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {!result && q.trim().length > 0 && q.trim().length < 2 && (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Type at least 2 characters to search.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
