import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireRole, requireClientAccess, getCurrentUser } from '@/lib/dal/session'
import type { FormSchemaV1 } from '@/lib/forms/schema'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import type { SubmissionStatus } from '@prisma/client'

// State machine — see docs/05-forms-and-submissions.md.
const ALLOWED: Record<SubmissionStatus, SubmissionStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'CHANGES_REQUESTED'],
  CHANGES_REQUESTED: ['SUBMITTED'],
  APPROVED: [],
  REJECTED: [],
}

export function canTransition(from: SubmissionStatus, to: SubmissionStatus): boolean {
  return ALLOWED[from].includes(to)
}

export type SubmissionDTO = {
  id: string
  clientId: string
  formId: string
  formTitle: string
  formData: Record<string, unknown>
  status: SubmissionStatus
  submittedAt: Date | null
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

function toDTO(s: {
  id: string
  clientId: string
  formId: string
  formData: unknown
  status: SubmissionStatus
  submittedAt: Date | null
  reviewedBy: string | null
  reviewedAt: Date | null
  createdAt: Date
  updatedAt: Date
  form: { title: string }
}): SubmissionDTO {
  return {
    id: s.id,
    clientId: s.clientId,
    formId: s.formId,
    formTitle: s.form.title,
    formData: (s.formData as Record<string, unknown>) ?? {},
    status: s.status,
    submittedAt: s.submittedAt,
    reviewedBy: s.reviewedBy,
    reviewedAt: s.reviewedAt,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

import { NotFoundError, ValidationError } from '@/lib/errors'

export const getSubmissionDTO = cache(async (submissionId: string): Promise<SubmissionDTO> => {
  const user = await getCurrentUser()
  if (!user) throw new Error('Not authenticated')

  // Build a lightweight check for existence and get the client ID first
  const subInfo = await prisma.submission.findFirst({
    where: { id: submissionId, deletedAt: null },
    select: { clientId: true },
  })
  if (!subInfo) {
    throw new NotFoundError('Submission')
  }

  // Check client access first to prevent timing leaks on unauthorized queries
  await requireClientAccess(subInfo.clientId)

  // Enforce CLIENT role matches its assigned client (extra guard)
  const where: Prisma.SubmissionWhereInput = {
    id: submissionId,
    deletedAt: null,
    ...(user.role === 'CLIENT' ? { clientId: user.client?.id } : {}),
  }

  const sub = await prisma.submission.findFirstOrThrow({
    where,
    include: { form: { select: { title: true } } },
  })

  return toDTO(sub)
})

export async function getOrCreateDraft(opts: {
  clientId: string
  formId: string
}): Promise<SubmissionDTO> {
  const { clientId, formId } = opts
  await requireClientAccess(clientId)

  const existing = await prisma.submission.findFirst({
    where: { clientId, formId, deletedAt: null },
    include: { form: { select: { title: true } } },
  })
  if (existing) return toDTO(existing)

  // First touch — create a draft. @@unique([clientId, formId]) makes this safe.
  const created = await prisma.submission.create({
    data: { clientId, formId, formData: {}, status: 'DRAFT' },
    include: { form: { select: { title: true } } },
  })
  return toDTO(created)
}

// Maximum bytes for a single submission's formData JSON. Protects against
// DB bloat from oversized payloads. 500KB is generous for structured form
// fields while still being safe.
const MAX_FORM_DATA_BYTES = 500_000

function enforceSizeLimit(formData: Record<string, unknown>): void {
  const size = Buffer.byteLength(JSON.stringify(formData), 'utf-8')
  if (size > MAX_FORM_DATA_BYTES) {
    throw new ValidationError(
      { formData: [`Form data exceeds ${MAX_FORM_DATA_BYTES / 1000}KB limit (${size} bytes)`] }
    )
  }
}

export async function saveDraft(opts: {
  clientId: string
  formId: string
  formData: Record<string, unknown>
}): Promise<void> {
  const { clientId, formId, formData } = opts
  await requireClientAccess(clientId)

  enforceSizeLimit(formData)

  await prisma.submission.upsert({
    where: { clientId_formId: { clientId, formId } },
    create: { clientId, formId, formData: formData as Prisma.InputJsonValue, status: 'DRAFT' },
    update: { formData: formData as Prisma.InputJsonValue },
  })
}

export async function submit(opts: {
  clientId: string
  formId: string
  formData: Record<string, unknown>
}): Promise<SubmissionDTO> {
  const { clientId, formId, formData } = opts
  const user = await requireClientAccess(clientId)

  enforceSizeLimit(formData)

  // Check + write happen in one transaction so a concurrent updateStatus can't
  // flip the status between the canTransition guard and the upsert (TOCTOU),
  // and so the audit row can never diverge from the business data. Mirrors
  // updateStatus() below. notify() stays fire-and-forget outside the tx.
  const upserted = await prisma.$transaction(async (tx) => {
    // Verify there's an active form — defense in depth.
    await tx.form.findFirstOrThrow({
      where: { id: formId, isActive: true, deletedAt: null },
    })

    // Lazy-validate the existing draft's state — only DRAFT and
    // CHANGES_REQUESTED can transition to SUBMITTED.
    const existing = await tx.submission.findFirst({
      where: { clientId, formId, deletedAt: null },
    })
    if (existing && !canTransition(existing.status, 'SUBMITTED')) {
      throw new Error(`Cannot submit from status ${existing.status}`)
    }

    const now = new Date()
    const row = await tx.submission.upsert({
      where: { clientId_formId: { clientId, formId } },
      create: {
        clientId,
        formId,
        formData: formData as Prisma.InputJsonValue,
        status: 'SUBMITTED',
        submittedAt: now,
      },
      update: {
        formData: formData as Prisma.InputJsonValue,
        status: 'SUBMITTED',
        submittedAt: now,
        // Clear any prior review fields — this is a fresh submission.
        reviewedBy: null,
        reviewedAt: null,
      },
      include: { form: { select: { title: true } } },
    })

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit(
      {
        action: 'SUBMISSION_SUBMITTED',
        userId: user!.id,
        resource: 'Submission',
        resourceId: row.id,
      },
      tx,
    )

    return row
  })

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'SUBMISSION_SUBMITTED',
    actorId: user!.id,
    clientId,
    submissionId: upserted.id,
    formTitle: upserted.form.title,
  })

  return toDTO(upserted)
}

export type SubmissionWithSchemaDTO = SubmissionDTO & {
  formSchema: unknown
}

export async function listSubmissionsWithSchema(clientId: string): Promise<SubmissionWithSchemaDTO[]> {
  await requireClientAccess(clientId)

  const rows = await prisma.submission.findMany({
    where: { clientId, deletedAt: null },
    include: { form: { select: { title: true, formSchema: true } } },
    orderBy: { updatedAt: 'desc' },
  })

  return rows.map((s) => ({
    ...toDTO(s),
    formSchema: s.form.formSchema,
  }))
}

export async function listSubmissionsForClient(
  clientId: string,
  params?: PaginationParams & { search?: string; status?: string },
): Promise<PaginatedResult<SubmissionDTO>> {
  await requireClientAccess(clientId)
  const { take, skip } = paginationParams(params)

  const where: Prisma.SubmissionWhereInput = { clientId, deletedAt: null }
  if (params?.search) {
    where.form = { title: { contains: params.search, mode: 'insensitive' } }
  }
  if (params?.status) {
    where.status = params.status as SubmissionStatus
  }

  const [rows, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      include: { form: { select: { title: true } } },
      orderBy: { updatedAt: 'desc' },
      take,
      skip,
    }),
    prisma.submission.count({ where }),
  ])

  return toPaginated(rows.map(toDTO), total, params)
}

export async function updateStatus(opts: {
  submissionId: string
  next: SubmissionStatus
}): Promise<void> {
  const user = await requireRole('SUPER_ADMIN', 'TEAM_MEMBER')
  const sub = await prisma.submission.findFirstOrThrow({ where: { id: opts.submissionId, deletedAt: null } })
  await requireClientAccess(sub.clientId)

  if (!canTransition(sub.status, opts.next)) {
    throw new Error(`Invalid transition ${sub.status} → ${opts.next}`)
  }

  const isReviewDecision = opts.next === 'APPROVED' || opts.next === 'REJECTED'

  // Wrap update + audit in a transaction so audit never diverges from the
  // business data. Notification is fire-and-forget outside the tx.
  await prisma.$transaction(async (tx) => {
    await tx.submission.update({
      where: { id: opts.submissionId },
      data: {
        status: opts.next,
        reviewedBy: isReviewDecision ? user.id : sub.reviewedBy,
        reviewedAt: isReviewDecision ? new Date() : sub.reviewedAt,
      },
    })

    const { writeAudit } = await import('@/lib/audit')
    await writeAudit(
      {
        action: `SUBMISSION_${opts.next}`,
        userId: user.id,
        resource: 'Submission',
        resourceId: opts.submissionId,
      },
      tx,
    )
  })

  // Notify the client of the status change.
  const { notify } = await import('@/lib/notifications/notify')
  const form = await prisma.form.findFirstOrThrow({
    where: { id: sub.formId, deletedAt: null },
    select: { title: true },
  })
  const eventBase = {
    actorId: user.id,
    clientId: sub.clientId,
    submissionId: opts.submissionId,
    formTitle: form.title,
  }
  switch (opts.next) {
    case 'IN_REVIEW':
      await notify({ type: 'SUBMISSION_IN_REVIEW', ...eventBase })
      break
    case 'CHANGES_REQUESTED':
      await notify({ type: 'SUBMISSION_CHANGES_REQUESTED', ...eventBase })
      break
    case 'APPROVED':
      await notify({ type: 'SUBMISSION_APPROVED', ...eventBase })
      break
    case 'REJECTED':
      await notify({ type: 'SUBMISSION_REJECTED', ...eventBase })
      break
  }
}

// Helper exported for tests + the form-filling UI.
export async function isValidAgainstSchema(schema: FormSchemaV1, data: unknown) {
  // Lazy-load the validator so this file doesn't pull zod into a client bundle.
  const { validateSubmission } = await import('@/lib/forms/validate')
  return validateSubmission(schema, data)
}

/**
 * Alias: documented name for requireClientAccess on submission's client.
 * Identical to calling requireClientAccess(sub.clientId) directly.
 */
export async function requireSubmissionAccess(submissionId: string): Promise<void> {
  const sub = await prisma.submission.findFirstOrThrow({
    where: { id: submissionId, deletedAt: null },
    select: { clientId: true },
  })
  await requireClientAccess(sub.clientId)
}

/**
 * Alias: documented name for updateStatus.
 */
export const updateSubmissionStatus = updateStatus

/**
 * List submissions for a given form (admin form detail page).
 * Requires SUPER_ADMIN or TEAM_MEMBER role.
 */
export async function listSubmissionsForForm(formId: string): Promise<
  Array<{ id: string; status: string; updatedAt: Date; client: { companyName: string; uniqueSlug: string } }>
> {
  await requireRole('SUPER_ADMIN', 'TEAM_MEMBER')

  return prisma.submission.findMany({
    where: { formId, deletedAt: null },
    include: { client: { select: { companyName: true, uniqueSlug: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  }) as unknown as Promise<
    Array<{ id: string; status: string; updatedAt: Date; client: { companyName: string; uniqueSlug: string } }>
  >
}
