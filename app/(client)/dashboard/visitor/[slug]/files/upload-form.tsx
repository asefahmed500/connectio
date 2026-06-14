'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { deleteFileAction } from './actions'

export function UploadForm({ clientId }: { clientId: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = e.currentTarget
    const fileInput = form.elements.namedItem('file') as HTMLInputElement
    if (!fileInput.files?.length) {
      setError('Choose a file first.')
      return
    }
    const file = fileInput.files[0]!

    setPending(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('clientId', clientId)
      const res = await fetch('/api/uploads', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Upload failed (HTTP ${res.status})`)
      }
      fileInput.value = ''
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="border rounded-lg p-4 space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="file">Upload a file</Label>
        <input
          id="file"
          name="file"
          type="file"
          className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-primary-foreground hover:file:bg-primary/80"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">
          Max 50 MB. Allowed: PDF, images, Office docs, ZIP, plain text.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Uploading…' : 'Upload'}
      </Button>
    </form>
  )
}

// Re-export the delete action so file-row.tsx can import from here.
export { deleteFileAction }
