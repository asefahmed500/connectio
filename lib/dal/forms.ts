import 'server-only'
import { cache } from 'react'
import { prisma } from '@/lib/db'
import { requireRole, requireClientAccess } from '@/lib/dal/session'
import { FormSchemaV1, parseFormSchema } from '@/lib/forms/schema'

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

export async function listAllForms(): Promise<FormSummary[]> {
  await requireRole('SUPER_ADMIN')
  const forms = await prisma.form.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { submissions: true } } },
  })
  return forms.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    isActive: f.isActive,
    fieldCount: (parseFormSchema(f.formSchema as unknown).fields.length),
    submissionCount: f._count.submissions,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }))
}

export async function listActiveFormsForClient(clientId: string): Promise<FormSummary[]> {
  await requireClientAccess(clientId)
  const forms = await prisma.form.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
    include: {
      submissions: {
        where: { clientId },
        select: { id: true, status: true, updatedAt: true },
      },
    },
  })
  return forms.map((f) => ({
    id: f.id,
    title: f.title,
    description: f.description,
    isActive: f.isActive,
    fieldCount: (parseFormSchema(f.formSchema as unknown).fields.length),
    submissionCount: f.submissions.length,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
  }))
}

export const getFormDTO = cache(async (formId: string) => {
  await requireRole('SUPER_ADMIN', 'TEAM_MEMBER')
  const form = await prisma.form.findUniqueOrThrow({ where: { id: formId } })
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
  const user = await requireRole('SUPER_ADMIN')
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
  const user = await requireRole('SUPER_ADMIN')
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
