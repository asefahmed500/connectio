import Link from 'next/link'
import { requireClientAccessBySlug } from '@/lib/dal/session'
import { listFilesForClient } from '@/lib/dal/files'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
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
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string; pageSize?: string }>
}) {
  const { slug } = await params
  const sParams = await searchParams
  const page = sParams.page ? parseInt(sParams.page, 10) : 1
  const pageSize = sParams.pageSize ? parseInt(sParams.pageSize, 10) : 20

  const clientId = await requireClientAccessBySlug(slug)
  const result = await listFilesForClient(clientId, { page, pageSize })
  const files = result.items

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-heading tracking-wide">Files</h1>
        <p className="text-sm text-muted-foreground">
          Upload briefs, references, and any documents your team has asked for.
        </p>
      </div>

      <UploadForm clientId={clientId} />

      <div>
        <h2 className="text-lg font-heading tracking-wide mb-3">Your files ({result.total})</h2>
        {files.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files uploaded yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              {files.map((f) => (
                <FileRow key={f.id} file={f} sizeLabel={formatSize(f.size)} />
              ))}
            </div>

            {result.totalPages > 1 && (
              <>
                <Separator />
                <div className="flex items-center justify-between pt-4">
                  <div className="text-xs text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, result.total)} of {result.total} results
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/dashboard/visitor/${slug}/files?page=${page - 1}&pageSize=${pageSize}`}
                      className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page <= 1 ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                    >
                      Previous
                    </Link>
                    <Link
                      href={`/dashboard/visitor/${slug}/files?page=${page + 1}&pageSize=${pageSize}`}
                      className={cn("inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-medium", page >= result.totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted")}
                    >
                      Next
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
