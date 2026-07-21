import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireRole, requireClientAccess, getCurrentUser } from '@/lib/dal/session'
import { requirePermission } from '@/lib/auth/permissions'
import { FormSchemaV1, parseFormSchema } from '@/lib/forms/schema'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import { NotFoundError } from '@/lib/errors'
import type { Prisma } from '@prisma/client'
import { proposeSlug } from '@/lib/dal/invites'

export type FormSummary = {
  id: string
  title: string
  description: string | null
  isActive: boolean
  fieldCount: number
  submissionCount: number
  createdAt: Date
  updatedAt: Date
}

import type { SubmissionStatus } from '@prisma/client'

export type ActiveFormSummary = {
  id: string
  title: string
  description: string | null
  isActive: boolean
  fieldCount: number
  submission: {
    id: string
    status: SubmissionStatus
    updatedAt: Date
  } | null
  createdAt: Date
  updatedAt: Date
}

export type FormListParams = PaginationParams & {
  search?: string
  isActive?: boolean
}

export async function listAllForms(params?: FormListParams): Promise<PaginatedResult<FormSummary>> {
  await requirePermission('form:read')
  const { take, skip } = paginationParams(params)

  const where: Prisma.FormWhereInput = { deletedAt: null }
  if (params?.search) {
    where.title = { contains: params.search, mode: 'insensitive' }
  }
  if (params?.isActive !== undefined) {
    where.isActive = params.isActive
  }

  const [rows, total] = await Promise.all([
    prisma.form.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { submissions: true } } },
      take,
      skip,
    }),
    prisma.form.count({ where }),
  ])

  const items = rows.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    isActive: f.isActive,
    fieldCount: (parseFormSchema(f.formSchema as unknown).fields.length),
    submissionCount: f._count.submissions,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }))

  return toPaginated(items, total, params)
}

export async function listActiveFormsForClient(clientId: string): Promise<ActiveFormSummary[]> {
  await requireClientAccess(clientId)
  const forms = await prisma.form.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    include: {
      submissions: {
        where: { clientId, deletedAt: null },
        select: { id: true, status: true, updatedAt: true },
        take: 1,
      },
    },
  })
  return forms.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    isActive: f.isActive,
    fieldCount: (parseFormSchema(f.formSchema as unknown).fields.length),
    submission: f.submissions[0] ?? null,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }))
}

export const getFormDTO = cache(async (formId: string) => {
  await requireRole('SUPER_ADMIN', 'TEAM_MEMBER')
  const form = await prisma.form.findFirstOrThrow({ where: { id: formId, deletedAt: null } })
  return {
    id: form.id,
    title: form.title,
    description: form.description,
    schema: parseFormSchema(form.formSchema as unknown),
    isActive: form.isActive,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
  }
})

export async function createForm(input: {
  title: string
  description?: string
  schema: FormSchemaV1
}): Promise<string> {
  const user = await requirePermission('form:create')
  const created = await prisma.form.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      formSchema: input.schema as unknown as object,
      isActive: false, // New forms start inactive; admin flips the switch.
    },
  })
  await writeAuditShim('FORM_CREATED', user.id, 'Form', created.id)
  return created.id
}

export async function updateForm(
  id: string,
  patch: {
    title?: string
    description?: string | null
    schema?: FormSchemaV1
    isActive?: boolean
  },
): Promise<void> {
  const user = await requirePermission('form:update')

  // Check form exists and is not soft-deleted before updating.
  const form = await prisma.form.findFirst({ where: { id, deletedAt: null } })
  if (!form) throw new NotFoundError('Form')

  await prisma.form.update({
    where: { id },
    data: {
      ...(patch.title !== undefined && { title: patch.title }),
      ...(patch.description !== undefined && { description: patch.description }),
      ...(patch.schema !== undefined && { formSchema: patch.schema as unknown as object }),
      ...(patch.isActive !== undefined && { isActive: patch.isActive }),
    },
  })
  await writeAuditShim('FORM_UPDATED', user.id, 'Form', id)
}

// Avoid a circular import with lib/audit (which we'll extend in the outbox
// milestone). Inline for now; route through lib/audit when outbox lands.
async function writeAuditShim(action: string, userId: string, resource: string, resourceId: string) {
  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({ action, userId, resource, resourceId })
}

/**
 * Lightweight form lookup for client submission pages (no role guard).
 * The caller (e.g. submissions/[id], submissions/new) has already validated
 * client access via requireClientAccessBySlug.
 */
export async function getFormForSubmission(formId: string): Promise<{
  id: string
  title: string
  description: string | null
  isActive: boolean
  formSchema: object
} | null> {
  const form = await prisma.form.findFirst({
    where: { id: formId, deletedAt: null },
    select: { id: true, title: true, description: true, isActive: true, formSchema: true },
  })
  return form as unknown as Promise<{
    id: string
    title: string
    description: string | null
    isActive: boolean
    formSchema: object
  } | null>
}

export type SendFormResult = {
  userId: string
  userName: string
  clientId: string
  slug: string
  submissionId: string
}

/**
 * Sends a form to one or more users. For each user:
 * 1. Ensures they have a Client record (creates one if needed)
 * 2. Ensures a draft submission exists
 * 3. Fires a FORM_ASSIGNED notification
 */
export async function sendFormToUsers(
  formId: string,
  userIds: string[],
): Promise<SendFormResult[]> {
  const admin = await requirePermission('form:update')

  const form = await prisma.form.findFirst({
    where: { id: formId, deletedAt: null },
    select: { id: true, title: true },
  })
  if (!form) throw new NotFoundError('Form')

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, deletedAt: null },
    include: { client: true },
  })

  const results: SendFormResult[] = []

  // Wrap the per-recipient loop in a single transaction so a mid-loop DB
  // failure rolls back EVERYTHING (no partial recipients get a form while
  // others don't). Audit + notify fire after the tx commits.
  const recipients: Array<{
    user: (typeof users)[number]
    client: NonNullable<(typeof users)[number]['client']> | { id: string; uniqueSlug: string }
    draftId: string
  }> = []

  await prisma.$transaction(async (tx) => {
    for (const user of users) {
      let client = user.client
        ? { id: user.client.id, uniqueSlug: user.client.uniqueSlug }
        : null
      if (!client) {
        const slug = await proposeSlug({
          contactName: user.name,
          companyName: user.name,
        })
        const created = await tx.client.create({
          data: {
            userId: user.id,
            companyName: user.name,
            contactName: user.name,
            uniqueSlug: slug,
          },
          select: { id: true, uniqueSlug: true },
        })
        client = { id: created.id, uniqueSlug: created.uniqueSlug }
      }

      // Ensure a draft submission exists within this tx.
      const existing = await tx.submission.findFirst({
        where: { clientId: client.id, formId: form.id, deletedAt: null },
        select: { id: true },
      })
      let draftId: string
      if (existing) {
        draftId = existing.id
      } else {
        const created = await tx.submission.create({
          data: {
            clientId: client.id,
            formId: form.id,
            formData: {},
            status: 'DRAFT',
          },
          select: { id: true },
        })
        draftId = created.id
      }

      recipients.push({ user, client, draftId })
    }
  })

  // Side-effects OUTSIDE the tx, per AGENTS.md convention.
  const { notify } = await import('@/lib/notifications/notify')
  for (const { user, client, draftId } of recipients) {
    // Correct action label: this is an assignment, not a schema edit.
    await writeAuditShim('FORM_ASSIGNED', admin.id, 'Form', form.id)
    await notify({
      type: 'FORM_ASSIGNED',
      actorId: admin.id,
      targetUserId: user.id,
      formId: form.id,
      formTitle: form.title,
      clientSlug: client.uniqueSlug,
    })

    results.push({
      userId: user.id,
      userName: user.name,
      clientId: client.id,
      slug: client.uniqueSlug,
      submissionId: draftId,
    })
  }

  return results
}
