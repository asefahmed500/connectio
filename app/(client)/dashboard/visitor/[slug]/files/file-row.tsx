'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import type { FileDTO } from '@/lib/dal/files'
import { deleteFileAction } from './actions'

export function FileRow({
  file,
  sizeLabel,
}: {
  file: FileDTO
  sizeLabel: string
}) {
  const [pending, startTransition] = useTransition()
  return (
    <li className="border rounded-lg p-3 flex justify-between items-center gap-3">
      <div className="min-w-0">
        <a
          href={`/api/uploads/${file.id}`}
          className="font-medium hover:underline truncate block"
          // Force download; never render untrusted content inline.
          download={file.originalName}
        >
          {file.originalName}
        </a>
        <div className="text-xs text-muted-foreground mt-0.5">
          {file.mimeType} · {sizeLabel} · {new Date(file.uploadedAt).toLocaleDateString()}
        </div>
      </div>
      <form
        action={() => {
          startTransition(async () => {
            await deleteFileAction(file.id)
          })
        }}
      >
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? 'Deleting…' : 'Delete'}
        </Button>
      </form>
    </li>
  )
}
