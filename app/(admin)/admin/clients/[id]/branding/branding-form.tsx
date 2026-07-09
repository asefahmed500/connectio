'use client'

import { useFormStatus } from 'react-dom'
import { saveClientSettingsAction, resetClientSettingsAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import type { ClientSettingsDTO } from '@/lib/dal/client-settings'

type Props = {
  clientId: string
  settings?: ClientSettingsDTO
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save branding'}
    </Button>
  )
}

export function BrandingForm({ clientId, settings }: Props) {
  const formAction = async (fd: FormData) => {
    await saveClientSettingsAction(clientId, null, fd)
  }

  return (
    <form action={formAction} noValidate>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Brand identity</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="brandColor">Brand color</FieldLabel>
                <div className="flex gap-2">
                  <input
                    id="brandColor"
                    name="brandColor"
                    type="color"
                    defaultValue={settings?.brandColor ?? '#0EA5E9'}
                    className="w-10 h-10 rounded border border-input cursor-pointer"
                  />
                  <input
                    name="brandColor"
                    type="text"
                    defaultValue={settings?.brandColor ?? '#0EA5E9'}
                    className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    placeholder="#0EA5E9"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Applied to the sidebar header and accent elements in the client portal.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="portalTitle">Portal title</FieldLabel>
                <input
                  id="portalTitle"
                  name="portalTitle"
                  type="text"
                  defaultValue={settings?.portalTitle ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="Client Portal"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Replaces &ldquo;ClientConnect&rdquo; in the sidebar header.
                </p>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Logos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="logoUrl">Logo URL</FieldLabel>
                <input
                  id="logoUrl"
                  name="logoUrl"
                  type="url"
                  defaultValue={settings?.logoUrl ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Displayed in the sidebar header. Recommended size: 120&times;40px.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="faviconUrl">Favicon URL</FieldLabel>
                <input
                  id="faviconUrl"
                  name="faviconUrl"
                  type="url"
                  defaultValue={settings?.faviconUrl ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="https://example.com/favicon.ico"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">Advanced</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customDomain">Custom domain</FieldLabel>
                <input
                  id="customDomain"
                  name="customDomain"
                  type="text"
                  defaultValue={settings?.customDomain ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="portal.clientname.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  White-label domain. You must configure DNS and a reverse proxy separately.
                </p>
              </Field>
              <Field>
                <FieldLabel htmlFor="customCss">Custom CSS</FieldLabel>
                <textarea
                  id="customCss"
                  name="customCss"
                  rows={4}
                  defaultValue={settings?.customCss ?? ''}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 font-mono"
                  placeholder="/* Custom CSS overrides */"
                />
              </Field>
              <Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="hideBranding"
                    defaultChecked={settings?.hideBranding ?? false}
                    className="rounded border-gray-300"
                  />
                  Hide &ldquo;ClientConnect&rdquo; branding
                </label>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <div className="flex items-center gap-2">
          <SubmitButton />
          <form action={resetClientSettingsAction.bind(null, clientId)}>
            <Button type="submit" variant="outline">
              Reset to defaults
            </Button>
          </form>
        </div>
      </div>
    </form>
  )
}
