// POST /api/uploads
// Multipart form data: file, clientId, submissionId?
// Streams to the storage adapter and creates a File row.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireClientAccess, getCurrentUser } from '@/lib/dal/session'
import { getStorage } from '@/lib/storage'
import {
  MAX_UPLOAD_BYTES,
  isAllowedExtension,
  isAllowedMime,
  matchesMagic,
  guessExtension,
  extensionOf,
  sanitizeFilename,
} from '@/lib/uploads/validate'
import { generateCuid } from '@/lib/cuid'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData()
  const clientId = String(form.get('clientId') ?? '')
  const submissionIdRaw = form.get('submissionId')
  const submissionId = submissionIdRaw ? String(submissionIdRaw) : null
  const file = form.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  try {
    await requireClientAccess(clientId)
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Validate size + declared MIME + extension before reading any bytes.
  if (file.size === 0) {
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${MAX_UPLOAD_BYTES} bytes)` },
      { status: 413 },
    )
  }
  if (!isAllowedMime(file.type)) {
    return NextResponse.json({ error: `MIME type not allowed: ${file.type}` }, { status: 400 })
  }
  if (!isAllowedExtension(extensionOf(file.name))) {
    return NextResponse.json(
      { error: `File extension not allowed: ${file.name}` },
      { status: 400 },
    )
  }

  // Verify submission belongs to this client (if provided).
  if (submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: submissionId, deletedAt: null } })
    if (!sub || sub.clientId !== clientId) {
      return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
    }
  }

  // Read the first ~16 bytes for magic-number sniffing without buffering
  // the whole file. We do this by reading the head, then concatenating it
  // back for the storage write.
  const blob = await file.arrayBuffer()
  const bytes = new Uint8Array(blob)
  if (!matchesMagic(file.type, bytes.subarray(0, 16))) {
    return NextResponse.json(
      { error: 'File contents do not match its declared type' },
      { status: 400 },
    )
  }

  const fileId = generateCuid()
  const ext = guessExtension(file.type, file.name)
  const storageKey = submissionId
    ? `clients/${clientId}/submissions/${submissionId}/${fileId}${ext}`
    : `clients/${clientId}/client/${fileId}${ext}`

  // Hand the bytes to the storage adapter.
  const storage = getStorage()
  // Build a fresh stream — arrayBuffer is consumed; we wrap the bytes back.
  const stream = new Response(bytes).body
  if (!stream) {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 500 })
  }

  let stored
  try {
    stored = await storage.put({
      stream,
      contentLength: bytes.length,
      targetPath: storageKey,
    })
  } catch (err) {
    // Don't echo storage/FS internals to the client — log them server-side only.
    console.error('[uploads] storage.put failed:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  if (stored.size !== BigInt(file.size)) {
    // Size mismatch — clean up and bail.
    await storage.delete(storageKey)
    return NextResponse.json({ error: 'Size mismatch after write' }, { status: 500 })
  }

  const created = await prisma.file.create({
    data: {
      id: fileId,
      clientId,
      submissionId,
      storageKey,
      originalName: sanitizeFilename(file.name),
      mimeType: file.type,
      size: stored.size,
      checksum: stored.sha256,
      uploadedById: user.id,
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'FILE_UPLOADED',
    userId: user.id,
    resource: 'File',
    resourceId: created.id,
  })

  // Notify the appropriate party. Client uploads → admins + assigned team.
  // Team/admin uploads → client. (Future: distinguish by author role.)
  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'FILE_UPLOADED_CLIENT',
    actorId: user.id,
    clientId,
    fileName: created.originalName,
  })

  return NextResponse.json(
    {
      id: created.id,
      storageKey: created.storageKey,
      originalName: created.originalName,
      mimeType: created.mimeType,
      size: created.size.toString(),
    },
    { status: 201 },
  )
}
