import Link from 'next/link'
import { requireClientAccessBySlug } from '@/lib/dal/session'
import { listFilesForClient } from '@/lib/dal/files'
import { UploadForm } from './upload-form'
import { FileRow } from './file-row'

export const metadata = { title: 'Files — ClientConnect' }

function formatSize(bytes: string): string {
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export default async function ClientFilesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const clientId = await requireClientAccessBySlug(slug)
  const files = await listFilesForClient(clientId)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
        <p className="text-sm text-muted-foreground">
          Upload briefs, references, and any documents your team has asked for.
        </p>
      </div>

      <UploadForm clientId={clientId} />

      <div>
        <h2 className="text-lg font-semibold mb-3">Your files</h2>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        ) : (
          <ul className="space-y-2">
            {files.map((f) => (
              <FileRow key={f.id} file={f} sizeLabel={formatSize(f.size)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
