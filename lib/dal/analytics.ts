import 'server-only'
import { prisma } from '@/lib/db'
import { requireRole } from '@/lib/dal/session'
import type { SubmissionStatus } from '@prisma/client'

// Aggregations for the admin dashboard. None of these hit >~10ms at the row
// counts we expect for v1 (low thousands). The point at which to introduce
// materialized views is roughly 100k submissions — flagged in REVIEW.md §2.6.

export type StatusBreakdown = Record<SubmissionStatus, number>

export async function getStatusBreakdown(): Promise<StatusBreakdown> {
  await requireRole('SUPER_ADMIN')
  const grouped = await prisma.submission.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  const empty: StatusBreakdown = {
    DRAFT: 0,
    SUBMITTED: 0,
    IN_REVIEW: 0,
    CHANGES_REQUESTED: 0,
    APPROVED: 0,
    REJECTED: 0,
  }
  return grouped.reduce((acc, g) => {
    acc[g.status] = g._count._all
    return acc
  }, empty)
}

export type DayBucket = { date: string; label: string; count: number }

export async function getSubmissionTrend(days = 14): Promise<DayBucket[]> {
  await requireRole('SUPER_ADMIN')
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const [submissions, clientCreates] = await Promise.all([
    prisma.submission.findMany({
      where: { submittedAt: { gte: since } },
      select: { submittedAt: true },
    }),
    prisma.client.findMany({
      where: { createdAt: { gte: since } },
      select: { createdAt: true },
    }),
  ])

  void clientCreates // reserved for the growth card; trend uses submissions only

  const buckets: DayBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    buckets.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      count: 0,
    })
  }
  const byDate = new Map(buckets.map((b) => [b.date, b]))
  for (const s of submissions) {
    if (!s.submittedAt) continue
    const key = s.submittedAt.toISOString().slice(0, 10)
    byDate.get(key)?.count != null && (byDate.get(key)!.count += 1)
  }
  return buckets
}

export type ActivityItem = {
  kind: 'submission' | 'comment' | 'file'
  at: string // ISO
  href: string
  // Submission
  submissionStatus?: SubmissionStatus
  formTitle?: string
  // Comment
  messagePreview?: string
  authorName?: string
  authorRole?: string
  isInternal?: boolean
  // File
  fileName?: string
  // Shared
  clientId: string
  clientName: string
}

export async function getRecentActivity(limit = 15): Promise<ActivityItem[]> {
  await requireRole('SUPER_ADMIN')

  const [subs, comments, files] = await Promise.all([
    prisma.submission.findMany({
      take: limit,
      orderBy: { updatedAt: 'desc' },
      where: { status: { not: 'DRAFT' } },
      include: {
        client: { select: { id: true, companyName: true } },
        form: { select: { title: true } },
      },
    }),
    prisma.comment.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, companyName: true } },
        author: { select: { name: true, role: true } },
      },
    }),
    prisma.file.findMany({
      take: limit,
      orderBy: { uploadedAt: 'desc' },
      include: { client: { select: { id: true, companyName: true } } },
    }),
  ])

  const items: ActivityItem[] = [
    ...subs.map<ActivityItem>((s) => ({
      kind: 'submission',
      at: s.updatedAt.toISOString(),
      href: `/admin/clients/${s.client.id}`,
      submissionStatus: s.status,
      formTitle: s.form.title,
      clientId: s.client.id,
      clientName: s.client.companyName,
    })),
    ...comments.map<ActivityItem>((c) => ({
      kind: 'comment',
      at: c.createdAt.toISOString(),
      href: `/admin/clients/${c.client.id}`,
      messagePreview: c.message.slice(0, 140),
      authorName: c.author.name,
      authorRole: c.author.role,
      isInternal: c.isInternal,
      clientId: c.client.id,
      clientName: c.client.companyName,
    })),
    ...files.map<ActivityItem>((f) => ({
      kind: 'file',
      at: f.uploadedAt.toISOString(),
      href: `/admin/clients/${f.client.id}`,
      fileName: f.originalName,
      clientId: f.client.id,
      clientName: f.client.companyName,
    })),
  ]

  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
}

export type TopClient = {
  id: string
  companyName: string
  uniqueSlug: string
  submissions: number
  comments: number
  files: number
  activityScore: number
}

export async function getTopClientsByActivity(limit = 5): Promise<TopClient[]> {
  await requireRole('SUPER_ADMIN')
  const clients = await prisma.client.findMany({
    include: {
      _count: { select: { submissions: true, comments: true, files: true } },
    },
  })
  return clients
    .map<TopClient>((c) => ({
      id: c.id,
      companyName: c.companyName,
      uniqueSlug: c.uniqueSlug,
      submissions: c._count.submissions,
      comments: c._count.comments,
      files: c._count.files,
      // Weighted: submissions count heaviest (they're the primary signal of
      // engagement), comments next, files least. Tunable.
      activityScore: c._count.submissions * 3 + c._count.comments + c._count.files,
    }))
    .sort((a, b) => b.activityScore - a.activityScore)
    .slice(0, limit)
}

export type DashboardStats = {
  totalClients: number
  totalSubmissions: number
  totalComments: number
  totalFiles: number
  pendingReview: number
  openInvites: number
  clientsThisMonth: number
}

export async function getDashboardStats(): Promise<DashboardStats> {
  await requireRole('SUPER_ADMIN')
  const [
    totalClients,
    totalSubmissions,
    totalComments,
    totalFiles,
    pendingReview,
    openInvites,
    clientsThisMonth,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.submission.count(),
    prisma.comment.count(),
    prisma.file.count(),
    prisma.submission.count({ where: { status: { in: ['SUBMITTED', 'IN_REVIEW'] } } }),
    prisma.invite.count({ where: { status: 'OPEN' } }),
    prisma.client.count({
      where: {
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ])
  return {
    totalClients,
    totalSubmissions,
    totalComments,
    totalFiles,
    pendingReview,
    openInvites,
    clientsThisMonth,
  }
}
