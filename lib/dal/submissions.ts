import 'server-only'
import { cache } from 'react'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { requireRole, requireClientAccess } from '@/lib/dal/session'
import type { FormSchemaV1 } from '@/lib/forms/schema'
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

export const getSubmissionDTO = cache(async (submissionId: string): Promise<SubmissionDTO> => {
  const sub = await prisma.submission.findUniqueOrThrow({
    where: { id: submissionId },
    include: { form: { select: { title: true } } },
  })
  await requireClientAccess(sub.clientId)
  return toDTO(sub)
})

export async function getOrCreateDraft(opts: {
  clientId: string
  formId: string
}): Promise<SubmissionDTO> {
  const { clientId, formId } = opts
  await requireClientAccess(clientId)

  const existing = await prisma.submission.findUnique({
    where: { clientId_formId: { clientId, formId } },
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

export async function saveDraft(opts: {
  clientId: string
  formId: string
  formData: Record<string, unknown>
}): Promise<void> {
  const { clientId, formId, formData } = opts
  await requireClientAccess(clientId)

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
  await requireClientAccess(clientId)

  // Verify there's an active form — defense in depth.
  const form = await prisma.form.findFirstOrThrow({
    where: { id: formId, isActive: true },
  })

  // Lazy-validate the existing draft's state — only DRAFT and CHANGES_REQUESTED
  // can transition to SUBMITTED.
  const existing = await prisma.submission.findUnique({
    where: { clientId_formId: { clientId, formId } },
  })
  if (existing && !canTransition(existing.status, 'SUBMITTED')) {
    throw new Error(`Cannot submit from status ${existing.status}`)
  }

  const now = new Date()
  const upserted = await prisma.submission.upsert({
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
  void form // satisfy lints

  const { notify } = await import('@/lib/notifications/notify')
  await notify({
    type: 'SUBMISSION_SUBMITTED',
    actorId: clientId, // no human actor for a client-side submit beyond the session; clientId is informative
    clientId,
    submissionId: upserted.id,
    formTitle: upserted.form.title,
  })

  return toDTO(upserted)
}

export async function listSubmissionsForClient(clientId: string): Promise<SubmissionDTO[]> {
  await requireClientAccess(clientId)
  const rows = await prisma.submission.findMany({
    where: { clientId },
    include: { form: { select: { title: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(toDTO)
}

export async function updateStatus(opts: {
  submissionId: string
  next: SubmissionStatus
}): Promise<void> {
  const user = await requireRole('SUPER_ADMIN', 'TEAM_MEMBER')
  const sub = await prisma.submission.findUniqueOrThrow({ where: { id: opts.submissionId } })
  await requireClientAccess(sub.clientId)

  if (!canTransition(sub.status, opts.next)) {
    throw new Error(`Invalid transition ${sub.status} → ${opts.next}`)
  }

  const isReviewDecision = opts.next === 'APPROVED' || opts.next === 'REJECTED'
  await prisma.submission.update({
    where: { id: opts.submissionId },
    data: {
      status: opts.next,
      reviewedBy: isReviewDecision ? user.id : sub.reviewedBy,
      reviewedAt: isReviewDecision ? new Date() : sub.reviewedAt,
    },
  })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: `SUBMISSION_${opts.next}`,
    userId: user.id,
    resource: 'Submission',
    resourceId: opts.submissionId,
  })

  // Notify the client of the status change.
  const { notify } = await import('@/lib/notifications/notify')
  const form = await prisma.form.findUniqueOrThrow({
    where: { id: sub.formId },
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
export function isValidAgainstSchema(schema: FormSchemaV1, data: unknown) {
  // Lazy-load the validator so this file doesn't pull zod into a client bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { validateSubmission } = require('@/lib/forms/validate') as typeof import('@/lib/forms/validate')
  return validateSubmission(schema, data)
}
