'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { FileDTO } from '@/lib/dal/files'
import { deleteFileAction } from './actions'

export function FileRow({
  file,
  sizeLabel,
}: {
  file: FileDTO
  sizeLabel: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <li>
      <Card>
        <CardContent className="p-3 flex justify-between items-center gap-3">
      <div className="min-w-0">
        <a
          href={`/api/uploads/${file.id}`}
          className="font-medium hover:underline truncate block"
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
          setError(null)
          startTransition(async () => {
            try {
              await deleteFileAction(file.id)
              router.refresh()
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Failed to delete file')
            }
          })
        }}
      >
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          {pending ? 'Deleting…' : 'Delete'}
        </Button>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </form>
        </CardContent>
      </Card>
    </li>
  )
}
