import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission } from '@/lib/auth/permissions'
import { getEmailTemplateById } from '@/lib/dal/email-templates'
import { EmailTemplateForm } from '../template-form'

export const metadata = { title: 'Edit Email Template — ClientConnect' }

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePermission('settings:manage')
  const { id } = await params

  const template = await getEmailTemplateById(id).catch(() => null)
  if (!template) notFound()

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/email-templates" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Email templates
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">{template.name}</h1>
      </div>
      <EmailTemplateForm mode="edit" template={template} />
    </div>
  )
}
