import Link from 'next/link'
import { requirePermission } from '@/lib/auth/permissions'
import { listEmailTemplates } from '@/lib/dal/email-templates'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmailTemplateActions } from './template-actions'

export const metadata = { title: 'Email templates — ClientConnect' }

export default async function EmailTemplatesPage() {
  await requirePermission('settings:manage')
  const templates = await listEmailTemplates()

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading tracking-wide">Email templates</h1>
          <p className="text-sm text-muted-foreground">
            Customize transactional email content.
          </p>
        </div>
        <Link
          href="/admin/email-templates/new"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New template
        </Link>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No email templates configured.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-sm font-heading tracking-wide">{t.name}</CardTitle>
                    <Badge variant="outline" className="font-mono text-[10px]">{t.key}</Badge>
                    {!t.isActive && <Badge variant="secondary">Disabled</Badge>}
                  </div>
                  <EmailTemplateActions templateId={t.id} />
                </div>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground space-y-1">
                <div className="font-mono truncate">{t.subject}</div>
                {t.variables && (
                  <div>Variables: <code>{t.variables}</code></div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
