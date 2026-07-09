'use client'

import { useFormStatus } from 'react-dom'
import { saveEmailTemplateAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import type { EmailTemplateDTO } from '@/lib/dal/email-templates'

type Props = {
  mode: 'create' | 'edit'
  template?: EmailTemplateDTO
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save template'}
    </Button>
  )
}

export function EmailTemplateForm({ mode, template }: Props) {
  const formAction = mode === 'create'
    ? async (fd: FormData) => { await saveEmailTemplateAction(null, fd) }
    : async (fd: FormData) => { await saveEmailTemplateAction(null, fd) }

  return (
    <form action={formAction} noValidate>
      <div className="flex flex-col gap-6 max-w-2xl">
        <input type="hidden" name="id" value={template?.id ?? ''} />
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">
              {mode === 'create' ? 'New email template' : 'Edit template'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="key">Template key</FieldLabel>
                  <input
                    id="key"
                    name="key"
                    type="text"
                    required
                    defaultValue={template?.key ?? ''}
                    readOnly={mode === 'edit'}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="welcome"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Stable identifier used by the code (e.g. <code>welcome</code>, <code>invite</code>).
                  </p>
                </Field>
                <Field>
                  <FieldLabel htmlFor="name">Display name</FieldLabel>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    defaultValue={template?.name ?? ''}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="Welcome email"
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="category">Category</FieldLabel>
                <input
                  id="category"
                  name="category"
                  type="text"
                  defaultValue={template?.category ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="onboarding"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="subject">Subject</FieldLabel>
                <input
                  id="subject"
                  name="subject"
                  type="text"
                  required
                  defaultValue={template?.subject ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Welcome to {{company}}"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="variables">Variables</FieldLabel>
                <input
                  id="variables"
                  name="variables"
                  type="text"
                  defaultValue={template?.variables ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="name, company, link"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated variable names usable as <code>{'{{name}}'}</code> in subject/body.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="textBody">Text body</FieldLabel>
                <textarea
                  id="textBody"
                  name="textBody"
                  rows={5}
                  defaultValue={template?.textBody ?? ''}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                  placeholder="Hello {{name}}, ..."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="htmlBody">HTML body (optional)</FieldLabel>
                <textarea
                  id="htmlBody"
                  name="htmlBody"
                  rows={6}
                  defaultValue={template?.htmlBody ?? ''}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                />
              </Field>
              {mode === 'edit' && (
                <Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={template?.isActive ?? true}
                      className="rounded border-gray-300"
                    />
                    Active
                  </label>
                </Field>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <SubmitButton />
          <a
            href="/admin/email-templates"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </a>
        </div>
      </div>
    </form>
  )
}
