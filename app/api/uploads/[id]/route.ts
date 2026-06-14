// GET  /api/uploads/[id]   → stream the file (or 404 if missing).
// DELETE /api/uploads/[id] → delete the row + underlying object.

import { NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { getFileDTO, deleteFile } from '@/lib/dal/files'
import { prisma } from '@/lib/db'
import { requireClientAccess } from '@/lib/dal/session'
import { getStorage } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const file = await getFileDTO(id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Auth check redundant with getFileDTO (which calls requireClientAccess),
  // but cheap to be explicit.
  try {
    await requireClientAccess(file.clientId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const storage = getStorage()
  let stream
  try {
    stream = await storage.get(file.storageKey)
  } catch {
    // File row exists but object is missing on disk — return a clear 410.
    return NextResponse.json(
      { error: 'File object missing from storage', storageKey: file.storageKey },
      { status: 410 },
    )
  }

  const headers = new Headers({
    'Content-Type': file.mimeType,
    'Content-Length': file.size,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    'Cache-Control': 'private, no-store',
  })

  // Node Readable → web Response body. Cast: Node's toWeb types want the
  // Readable class, not the interface; the runtime conversion is fine.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webStream = Readable.toWeb(stream as any) as unknown as BodyInit
  return new Response(webStream, { headers })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const file = await prisma.file.findUnique({ where: { id } })
  if (!file) return new NextResponse(null, { status: 204 })

  try {
    await deleteFile(id)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Delete failed' },
      { status: 403 },
    )
  }
  return new NextResponse(null, { status: 204 })
}
