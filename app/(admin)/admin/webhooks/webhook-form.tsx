'use client'

import { useFormStatus } from 'react-dom'
import { createWebhookAction, updateWebhookAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import type { WebhookDTO } from '@/lib/dal/webhooks'

type Props = {
  mode: 'create' | 'edit'
  webhook?: WebhookDTO
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : label}
    </Button>
  )
}

export function WebhookForm({ mode, webhook }: Props) {
  const formAction = async (fd: FormData) => {
    if (mode === 'create') {
      await createWebhookAction(null, fd)
    } else {
      await updateWebhookAction(webhook!.id, null, fd)
    }
  }

  const eventsStr = webhook?.events
    ? webhook.events[0] === '*'
      ? '*'
      : webhook.events.join(', ')
    : '*'

  return (
    <form action={formAction} noValidate>
      <div className="flex flex-col gap-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">
              {mode === 'create' ? 'New webhook' : 'Webhook details'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="name">Name</FieldLabel>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  defaultValue={webhook?.name ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="My webhook"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="url">Endpoint URL</FieldLabel>
                <input
                  id="url"
                  name="url"
                  type="url"
                  required
                  defaultValue={webhook?.url ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="https://example.com/webhook"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="secret">Secret (for HMAC signing)</FieldLabel>
                <input
                  id="secret"
                  name="secret"
                  type="text"
                  defaultValue={webhook?.secret ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Auto-generated if empty"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Leave empty to auto-generate. Used to sign payloads with <code>X-Signature-256</code> header.
                </p>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Events</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="events">Subscribed events</FieldLabel>
                <input
                  id="events"
                  name="events"
                  type="text"
                  defaultValue={eventsStr}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="*  or audit, USER_CREATED, SUBMISSION_SUBMITTED"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use <code>*</code> for all events, or a comma-separated list of event names.
                  Available events: <code>audit</code> for audit log entries, or any notification type.
                </p>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Delivery settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel htmlFor="retryCount">Max retries</FieldLabel>
                  <input
                    id="retryCount"
                    name="retryCount"
                    type="number"
                    min={0}
                    max={10}
                    defaultValue={webhook?.retryCount ?? 3}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="timeoutSec">Timeout (seconds)</FieldLabel>
                  <input
                    id="timeoutSec"
                    name="timeoutSec"
                    type="number"
                    min={1}
                    max={60}
                    defaultValue={webhook?.timeoutSec ?? 10}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </Field>
              </div>
              {mode === 'edit' && (
                <Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={webhook?.isActive ?? true}
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
          <SubmitButton label={mode === 'create' ? 'Create webhook' : 'Save changes'} />
          <a
            href="/admin/webhooks"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Cancel
          </a>
        </div>
      </div>
    </form>
  )
}
