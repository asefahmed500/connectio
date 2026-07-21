import 'server-only'
import { prisma } from '@/lib/db'
import { requirePermission } from '@/lib/auth/permissions'
import { NotFoundError } from '@/lib/errors'

export type EmailTemplateDTO = {
  id: string
  key: string
  name: string
  category: string | null
  subject: string
  htmlBody: string | null
  textBody: string | null
  variables: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

function toDTO(t: Record<string, unknown>): EmailTemplateDTO {
  return {
    id: t.id as string,
    key: t.key as string,
    name: t.name as string,
    category: t.category as string | null,
    subject: t.subject as string,
    htmlBody: t.htmlBody as string | null,
    textBody: t.textBody as string | null,
    variables: t.variables as string | null,
    isActive: t.isActive as boolean,
    createdAt: t.createdAt as Date,
    updatedAt: t.updatedAt as Date,
  }
}

export async function listEmailTemplates(): Promise<EmailTemplateDTO[]> {
  await requirePermission('settings:manage')
  const rows = await prisma.emailTemplate.findMany({ orderBy: { name: 'asc' } })
  return rows.map((r) => toDTO(r as unknown as Record<string, unknown>))
}

export async function getEmailTemplate(key: string): Promise<EmailTemplateDTO | null> {
  await requirePermission('settings:manage')
  const row = await prisma.emailTemplate.findUnique({ where: { key } })
  return row ? toDTO(row as unknown as Record<string, unknown>) : null
}

export async function getEmailTemplateById(id: string): Promise<EmailTemplateDTO> {
  await requirePermission('settings:manage')
  const row = await prisma.emailTemplate.findUnique({ where: { id } })
  if (!row) throw new NotFoundError('EmailTemplate')
  return toDTO(row as unknown as Record<string, unknown>)
}

/**
 * Render a template by key, substituting {{var}} placeholders.
 * Falls back to the supplied default when no active DB template exists.
 */
export async function renderStoredTemplate(
  key: string,
  vars: Record<string, string>,
  fallback: { subject: string; text: string; html?: string },
): Promise<{ subject: string; text: string; html?: string }> {
  const tpl = await prisma.emailTemplate.findUnique({ where: { key, isActive: true } })
  if (!tpl) return fallback

  const apply = (s: string) =>
    s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => vars[name] ?? '')

  return {
    subject: apply(tpl.subject),
    text: apply(tpl.textBody ?? fallback.text),
    html: tpl.htmlBody ? apply(tpl.htmlBody) : fallback.html,
  }
}

export async function upsertEmailTemplate(data: {
  /** When provided, update by id (preserves the row even if `key` changes). */
  id?: string
  key: string
  name: string
  category?: string | null
  subject: string
  htmlBody?: string | null
  textBody?: string | null
  variables?: string | null
  isActive?: boolean
}): Promise<string> {
  const user = await requirePermission('settings:manage')

  let row: { id: string }
  if (data.id) {
    // Update by id — preserves the row even if the key changed. If the new
    // key collides with another template, Prisma throws P2002 and the
    // action surfaces a friendly error.
    row = await prisma.emailTemplate.update({
      where: { id: data.id },
      data: {
        key: data.key,
        name: data.name,
        category: data.category ?? null,
        subject: data.subject,
        htmlBody: data.htmlBody ?? null,
        textBody: data.textBody ?? null,
        variables: data.variables ?? null,
        isActive: data.isActive ?? true,
      },
    })
  } else {
    row = await prisma.emailTemplate.upsert({
      where: { key: data.key },
      create: {
        key: data.key,
        name: data.name,
        category: data.category ?? null,
        subject: data.subject,
        htmlBody: data.htmlBody ?? null,
        textBody: data.textBody ?? null,
        variables: data.variables ?? null,
        isActive: data.isActive ?? true,
      },
      update: {
        name: data.name,
        category: data.category ?? null,
        subject: data.subject,
        htmlBody: data.htmlBody ?? null,
        textBody: data.textBody ?? null,
        variables: data.variables ?? null,
        isActive: data.isActive ?? true,
      },
    })
  }

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'EMAIL_TEMPLATE_UPDATED',
    userId: user.id,
    resource: 'EmailTemplate',
    resourceId: row.id,
  })

  return row.id
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const user = await requirePermission('settings:manage')
  const existing = await prisma.emailTemplate.findUnique({ where: { id } })
  if (!existing) throw new NotFoundError('EmailTemplate')
  await prisma.emailTemplate.delete({ where: { id } })

  const { writeAudit } = await import('@/lib/audit')
  await writeAudit({
    action: 'EMAIL_TEMPLATE_DELETED',
    userId: user.id,
    resource: 'EmailTemplate',
    resourceId: id,
  })
}
