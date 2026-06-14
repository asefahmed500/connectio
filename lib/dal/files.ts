import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireClientAccess, getCurrentUser } from '@/lib/dal/session'

export type FileDTO = {
  id: string
  clientId: string
  submissionId: string | null
  storageKey: string
  originalName: string
  mimeType: string
  size: string // BigInt → string for serialization
  uploadedById: string
  uploadedAt: string // ISO for client serialization
}

function toDTO(f: {
  id: string
  clientId: string
  submissionId: string | null
  storageKey: string
  originalName: string
  mimeType: string
  size: bigint
  uploadedById: string
  uploadedAt: Date
}): FileDTO {
  return {
    id: f.id,
    clientId: f.clientId,
    submissionId: f.submissionId,
    storageKey: f.storageKey,
    originalName: f.originalName,
    mimeType: f.mimeType,
    size: f.size.toString(),
    uploadedById: f.uploadedById,
    uploadedAt: f.uploadedAt.toISOString(),
  }
}

export async function listFilesForClient(clientId: string): Promise<FileDTO[]> {
  await requireClientAccess(clientId)
  const rows = await prisma.file.findMany({
    where: { clientId },
    orderBy: { uploadedAt: 'desc' },
  })
  return rows.map(toDTO)
}

export const getFileDTO = cache(async (fileId: string): Promise<FileDTO | null> => {
  const f = await prisma.file.findUnique({ where: { id: fileId } })
  if (!f) return null
  await requireClientAccess(f.clientId)
  return toDTO(f)
})

export async function deleteFile(fileId: string): Promise<void> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  const file = await prisma.file.findUnique({ where: { id: fileId } })
  if (!file) return
  await requireClientAccess(file.clientId)

  // Uploader, SUPER_ADMIN, or assigned team member may delete.
  const canDelete =
    user.role === 'SUPER_ADMIN' ||
    file.uploadedById === user.id ||
    (user.role === 'TEAM_MEMBER' &&
      user.teamMember !== null &&
      (await prisma.teamAssignment.findUnique({
        where: {
          teamMemberId_clientId: {
            teamMemberId: user.teamMember.id,
            clientId: file.clientId,
          },
        },
      })) !== null)

  if (!canDelete) throw new Error('Not allowed to delete this file')

  // REVIEW-3.md §3.5 fix: delete storage BEFORE the row. If storage delete
  // succeeds and the DB delete fails, the row points at a missing object —
  // catch on next read and offer re-upload. (Reverse order: orphan row if
  // storage delete fails. We choose the former because storage is cheaper
  // to re-upload than to lose.)
  const { getStorage } = await import('@/lib/storage')
  const storage = getStorage()
  await storage.delete(file.storageKey)
  await prisma.file.delete({ where: { id: fileId } })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'FILE_DELETED',
    userId: user.id,
    resource: 'File',
    resourceId: fileId,
  })
}
