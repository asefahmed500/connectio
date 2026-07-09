import Link from 'next/link'
import { requirePermission } from '@/lib/auth/permissions'
import { EmailTemplateForm } from '../template-form'

export const metadata = { title: 'New Email Template — ClientConnect' }

export default async function NewTemplatePage() {
  await requirePermission('settings:manage')

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <Link href="/admin/email-templates" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Email templates
        </Link>
        <h1 className="text-3xl font-heading tracking-wide mt-2">New email template</h1>
      </div>
      <EmailTemplateForm mode="create" />
    </div>
  )
}
