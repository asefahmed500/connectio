import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireRole, requireClientAccess } from '@/lib/dal/session'
import { requirePermission } from '@/lib/auth/permissions'
import { FormSchemaV1, parseFormSchema } from '@/lib/forms/schema'
import { PaginationParams, PaginatedResult, paginationParams, toPaginated } from '@/lib/dal/pagination'
import { NotFoundError } from '@/lib/errors'
import type { Prisma } from '@prisma/client'

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
