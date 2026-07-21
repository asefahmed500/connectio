'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check, Link2 } from 'lucide-react'

export function CopyLinkButton({
  slug,
  disabled,
}: {
  slug: string
  disabled?: boolean
}) {
  const [copied, setCopied] = useState(false)

  const href = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${slug}`

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      aria-label={`Copy invite link for ${slug}`}
      onClick={() => {
        if (disabled) return
        navigator.clipboard.writeText(href)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? (
        <>
          <Check className="w-3 h-3 text-emerald-600" data-icon="inline-start" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" data-icon="inline-start" />
          Copy link
        </>
      )}
    </Button>
  )
}

// Also export a compact icon-only variant for tight table rows.
export function CopyLinkIcon({ slug, disabled }: { slug: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false)
  const href = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/invite/${slug}`

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      disabled={disabled}
      aria-label={`Copy invite link for ${slug}`}
      onClick={() => {
        if (disabled) return
        navigator.clipboard.writeText(href)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied
        ? <Check className="w-3 h-3 text-emerald-600" />
        : <Link2 className="w-3 h-3" />}
    </Button>
  )
}
