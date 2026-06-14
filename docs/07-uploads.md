# 07 — Uploads

**Status:** Draft
**Models:** `File`
**Storage:** pluggable via `StorageAdapter` — local FS in dev, S3 (or S3-compatible: R2, Vercel Blob) in prod.
**Routes:** `POST /api/uploads` (initiate) · `GET /api/uploads/[id]` (download) · `DELETE /api/uploads/[id]`

Files attach to either a Submission or a Client directly (intake briefs, etc.). The DB row is created after the bytes are persisted, so we never have a `File` row pointing at nothing.

## Storage adapter

```ts
// lib/storage/adapter.ts
export interface StorageAdapter {
  /**
   * Stream a file into storage. Returns the storage key for later retrieval.
   * Implementations MUST verify size and checksum before returning.
   */
  put(opts: {
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream
    mimeType: string
    contentLength: number
    targetPath: string
  }): Promise<{ key: string; sha256: string; size: bigint }>

  /** Returns a stream or a presigned URL depending on mode. */
  get(key: string): Promise<ReadableStream<Uint8Array> | string>

  /** Delete by key. Idempotent. */
  delete(key: string): Promise<void>

  /** Generate a presigned upload URL for direct-to-S3 uploads. Optional. */
  presignPut?(opts: { key: string; mimeType: string; contentLength: number; expiresIn: number }): Promise<string>
}
```

Two implementations:

| Adapter | When | Files go to |
|---------|------|-------------|
| `LocalFsAdapter` | `NODE_ENV !== 'production'` | `./storage/<key>` (gitignored) |
| `S3Adapter` | production | S3 bucket configured via `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET` |

Wired in `lib/storage/index.ts`:

```ts
// lib/storage/index.ts
import 'server-only'
import { LocalFsAdapter } from './local-fs'
import { S3Adapter } from './s3'

export const storage: StorageAdapter =
  process.env.NODE_ENV === 'production'
    ? new S3Adapter({ /* env */ })
    : new LocalFsAdapter({ root: './storage' })
```

## Validation rules

Enforced in the route handler before any byte is read:

| Rule | Limit |
|------|-------|
| Max total size per request | 50 MB (`MAX_UPLOAD_BYTES`) |
| Allowed MIME types | `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `text/plain`, `text/markdown`, `application/vnd.open-ms…` (docx/xlsx/pptx), `application/zip` |
| Disallowed extensions (even if MIME lies) | `.exe`, `.bat`, `.cmd`, `.sh`, `.js`, `.html`, `.svg` (script risk) |
| Filename length | 1–255 chars |
| Per-user per-hour rate | 50 uploads |

The MIME check uses both `Content-Type` *and* magic-number sniffing (`file-type` library). Mismatched headers are rejected.

## Storage key layout

```
clients/<clientId>/submissions/<submissionId>/<fileId>.<ext>
clients/<clientId>/client/<fileId>.<ext>           # client-level uploads
```

`fileId` is the cuid of the `File` row. This makes it trivial to delete all files for a client (recursive prefix delete) or for a submission.

## Upload flow

Two strategies, picked per deployment:

### Strategy A: server-streamed (default in dev; simpler)

```
Browser
  │ multipart/form-data POST /api/uploads
  ▼
Route Handler
  │  1. Auth via DAL (requireClientAccess)
  │  2. Validate (size, MIME, magic number)
  │  3. Stream to StorageAdapter.put()
  │  4. Create File row in DB
  ▼
201 Created { id, ... }
```

### Strategy B: presigned URL (production; recommended)

For larger files and to avoid routing all bytes through the Next server:

```
1. Browser → POST /api/uploads (metadata only: { clientId, submissionId, mimeType, size })
2. Server validates metadata, generates storageKey, calls storage.presignPut()
3. Server returns { uploadUrl, key, fileId }

4. Browser PUTs the bytes directly to S3 (uploadUrl, signed for 5 min)

5. Browser → POST /api/uploads/<fileId>/complete
6. Server verifies the object exists, checks size+checksum, creates File row
```

Strategy B requires `presignPut` on the adapter; otherwise falls back to A.

## Route handler (Strategy A)

```ts
// app/api/uploads/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { storage } from '@/lib/storage'
import { prisma } from '@/lib/db'
import { requireClientAccess } from '@/lib/dal/session'
import { validateUpload } from '@/lib/uploads/validate'
import { writeAudit } from '@/lib/audit'

const MAX_BYTES = 50 * 1024 * 1024

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const clientId     = String(form.get('clientId'))
  const submissionId = form.get('submissionId') ? String(form.get('submissionId')) : null
  const file         = form.get('file') as File

  const claims = await requireClientAccess(clientId)

  const validated = validateUpload({ file, clientId, submissionId })
  if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 })

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File too large' }, { status: 413 })
  }

  // Verify the submission (if any) belongs to this client.
  if (submissionId) {
    const sub = await prisma.submission.findUnique({ where: { id: submissionId } })
    if (!sub || sub.clientId !== clientId) {
      return NextResponse.json({ error: 'Invalid submission' }, { status: 400 })
    }
  }

  const fileId = generateCuid()
  const ext = guessExtension(file.type, file.name)
  const key = submissionId
    ? `clients/${clientId}/submissions/${submissionId}/${fileId}${ext}`
    : `clients/${clientId}/client/${fileId}${ext}`

  // Stream to storage. We pass the size from Content-Length, validated above.
  const result = await storage.put({
    stream: file.stream(),
    mimeType: file.type,
    contentLength: file.size,
    targetPath: key,
  })

  // Sanity: storage-returned size must match what we streamed.
  if (result.size !== BigInt(file.size)) {
    await storage.delete(key)
    return NextResponse.json({ error: 'Size mismatch' }, { status: 500 })
  }

  const created = await prisma.file.create({
    data: {
      id: fileId,
      clientId,
      submissionId,
      storageKey: key,
      originalName: file.name,
      mimeType: file.type,
      size: result.size,
      checksum: result.sha256,
      uploadedById: claims.sub,
    },
  })

  await writeAudit('FILE_UPLOADED', claims.sub, 'File', created.id)

  return NextResponse.json({
    id: created.id,
    storageKey: created.storageKey,
    mimeType: created.mimeType,
    size: created.size.toString(),
  }, { status: 201 })
}
```

## Download flow

```ts
// app/api/uploads/[id]/route.ts
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = await prisma.file.findUniqueOrThrow({ where: { id } })

  // Auth check based on which client this file belongs to.
  await requireClientAccess(file.clientId)

  // For S3Adapter, this returns a presigned download URL (5-min TTL).
  // For LocalFsAdapter, returns a ReadableStream.
  const result = await storage.get(file.storageKey)

  if (typeof result === 'string') {
    return NextResponse.redirect(result, { headers: {
      'Content-Disposition': `attachment; filename="${file.originalName}"`,
    }})
  }

  return new Response(result, { headers: {
    'Content-Type': file.mimeType,
    'Content-Disposition': `attachment; filename="${file.originalName}"`,
    'Content-Length': file.size.toString(),
  }})
}
```

Notes:
- **Presigned URLs include the storage key but are signed.** Don't expose them to the client if they're for server-streaming. The redirect path is fine because the URL is short-lived.
- **`Content-Disposition: attachment`** prevents the browser from rendering untrusted HTML/SVG inline. (We also reject those MIME types at upload.)

## Delete flow

```ts
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const file = await prisma.file.findUniqueOrThrow({ where: { id } })
  const claims = await requireClientAccess(file.clientId)

  // Only uploader, SUPER_ADMIN, or assigned team member may delete.
  const teamMember = claims.role === 'TEAM_MEMBER'
    ? await prisma.teamAssignment.findUnique({ where: { teamMemberId_clientId: { teamMemberId: claims.sub, clientId: file.clientId } } })
    : null
  const canDelete =
    claims.role === 'SUPER_ADMIN' ||
    file.uploadedById === claims.sub ||
    teamMember !== null
  if (!canDelete) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await storage.delete(file.storageKey)
  await prisma.file.delete({ where: { id } })

  await writeAudit('FILE_DELETED', claims.sub, 'File', file.id)
  return NextResponse.json({ ok: true })
}
```

## Cleanup

- **Orphan detection:** nightly Vercel Cron job scans storage for keys not present in `File` (and vice-versa). Reports mismatches; deletes orphans older than 7 days.
- **Cascade:** when a `Client` or `Submission` is deleted, the cascade policy removes the `File` rows; the DAL **must** also delete the underlying storage object before the row delete. Enforced by a `beforeDelete` Prisma extension.

## Open questions

- **Antivirus scanning.** Recommended for prod. ClamAV via a Lambda or pre-signed URL flow with bucket notification. Not in v1; flagged for security review.
- **Image processing.** Thumbnails for images? Nice-to-have; would use `sharp` on upload to generate derived sizes.
- **Quotas.** Per-client storage cap? Recommended for v2.
