import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireRole, requireClientAccess } from '@/lib/dal/session'

export type ClientDTO = {
  id: string
  companyName: string
  contactName: string
  uniqueSlug: string
  projectBrief: string | null
  budget: string | null
  timeline: string | null
  submissionsCount: number
  commentsCount: number
  filesCount: number
  lastActivityAt: Date | null
  createdAt: Date
}

async function toDTO(c: {
  id: string
  companyName: string
  contactName: string
  uniqueSlug: string
  projectBrief: string | null
  budget: string | null
  timeline: string | null
  _count: { submissions: number; comments: number; files: number }
  submissions: { updatedAt: Date }[]
  createdAt: Date
}): Promise<ClientDTO> {
  return {
    id: c.id,
    companyName: c.companyName,
    contactName: c.contactName,
    uniqueSlug: c.uniqueSlug,
    projectBrief: c.projectBrief,
    budget: c.budget,
    timeline: c.timeline,
    submissionsCount: c._count.submissions,
    commentsCount: c._count.comments,
    filesCount: c._count.files,
    lastActivityAt: c.submissions[0]?.updatedAt ?? null,
    createdAt: c.createdAt,
  }
}

export async function listAllClients(): Promise<ClientDTO[]> {
  await requireRole('SUPER_ADMIN')
  const rows = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { submissions: true, comments: true, files: true } },
      submissions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
    },
  })
  return Promise.all(rows.map(toDTO))
}

export const getClientDTO = cache(async (clientId: string): Promise<ClientDTO | null> => {
  await requireClientAccess(clientId)
  const c = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      _count: { select: { submissions: true, comments: true, files: true } },
      submissions: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
    },
  })
  if (!c) return null
  return toDTO(c)
})
