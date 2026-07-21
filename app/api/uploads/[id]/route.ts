import { NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { getFileDTO, deleteFile } from '@/lib/dal/files'
import { getCurrentUser } from '@/lib/dal/session'
import { checkSameOrigin } from '@/lib/auth/csrf'
import { prisma } from '@/lib/db'
import { getStorage } from '@/lib/storage'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const file = await getFileDTO(id)
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const storage = getStorage()
  let stream
  try {
    stream = await storage.get(file.storageKey)
  } catch {
    return NextResponse.json({ error: 'File unavailable' }, { status: 410 })
  }

  const headers = new Headers({
    'Content-Type': file.mimeType,
    'Content-Length': file.size,
    'Content-Disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    'Cache-Control': 'private, no-store',
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webStream = Readable.toWeb(stream as any) as unknown as BodyInit
  return new Response(webStream, { headers })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!checkSameOrigin(req.headers)) {
    return NextResponse.json({ error: 'CSRF check failed' }, { status: 403 })
  }
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { id } = await params
    const file = await prisma.file.findUnique({ where: { id, deletedAt: null } })
    if (!file) return new NextResponse(null, { status: 204 })

    await deleteFile(id)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error('[uploads] delete failed:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
