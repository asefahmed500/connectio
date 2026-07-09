'use client'

import Link from 'next/link'
import { deleteSsoAction } from './actions'
import { Button } from '@/components/ui/button'
import { Edit3, Trash2 } from 'lucide-react'

export function SsoProviderActions({ providerId }: { providerId: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={`/admin/sso/${providerId}`}>
        <Button variant="ghost" size="icon-sm">
          <Edit3 className="w-3 h-3" />
        </Button>
      </Link>
      <form action={deleteSsoAction.bind(null, providerId)}>
        <Button variant="ghost" size="icon-sm" type="submit">
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </form>
    </div>
  )
}
