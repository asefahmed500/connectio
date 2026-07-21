import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, requireSession } from '@/lib/dal/session'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ users: [], clients: [], submissions: [] })
  }

  const [users, clients, submissions] = await Promise.all([
    prisma.user.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, email: true, role: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.client.findMany({
      where: {
        deletedAt: null,
        OR: [
          { companyName: { contains: q, mode: 'insensitive' } },
          { contactName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, companyName: true, contactName: true, uniqueSlug: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.submission.findMany({
      where: {
        client: { deletedAt: null },
        form: { title: { contains: q, mode: 'insensitive' } },
      },
      include: {
        client: { select: { id: true, companyName: true, uniqueSlug: true } },
        form: { select: { title: true } },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const submissionsResult = submissions.map((s) => ({
    id: s.id,
    status: s.status,
    formId: s.formId,
    formTitle: s.form.title,
    clientId: s.client?.id ?? '',
    clientName: s.client?.companyName ?? '—',
    clientSlug: s.client?.uniqueSlug ?? '',
    createdAt: s.createdAt,
  }))

  return NextResponse.json({ users, clients, submissions: submissionsResult })
}
