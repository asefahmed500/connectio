'use client'

import Link from 'next/link'
import { deleteEmailTemplateAction } from './actions'
import { Button } from '@/components/ui/button'
import { Edit3, Trash2 } from 'lucide-react'

export function EmailTemplateActions({ templateId }: { templateId: string }) {
  return (
    <div className="flex items-center gap-1">
      <Link href={`/admin/email-templates/${templateId}`}>
        <Button variant="ghost" size="icon-sm" aria-label={`Edit template`}>
          <Edit3 className="w-3 h-3" />
        </Button>
      </Link>
      <form action={deleteEmailTemplateAction.bind(null, templateId)}>
        <Button variant="ghost" size="icon-sm" type="submit" aria-label={`Delete template`}>
          <Trash2 className="w-3 h-3 text-destructive" />
        </Button>
      </form>
    </div>
  )
}
