'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type SsoProvider = { id: string; name: string; providerType: string }

export function SsoButtons() {
  const [providers, setProviders] = useState<SsoProvider[]>([])

  useEffect(() => {
    fetch('/api/auth/sso')
      .then((r) => r.json())
      .then(setProviders)
      .catch(() => {})
  }, [])

  if (providers.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="relative my-2">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
        </div>
      </div>

      {providers.map((p) => (
        <SsoButton key={p.id} provider={p} />
      ))}
    </div>
  )
}

function SsoButton({ provider }: { provider: SsoProvider }) {
  const href = `/api/auth/sso/${provider.id}/initiate`

  return (
    <Button variant="outline" className="w-full" asChild>
      <a href={href}>
        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3" />
        </svg>
        {provider.name}
      </a>
    </Button>
  )
}
