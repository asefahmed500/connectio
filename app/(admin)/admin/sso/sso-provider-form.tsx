'use client'

import { useFormStatus } from 'react-dom'
import { createSsoAction, updateSsoAction } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FieldGroup, Field, FieldLabel } from '@/components/ui/field'
import type { SsoProviderDTO } from '@/lib/dal/sso'

type Props = {
  mode: 'create' | 'edit'
  provider?: SsoProviderDTO
}

export function SsoProviderForm({ mode, provider }: Props) {
  const formAction = async (fd: FormData) => {
    if (mode === 'create') {
      await createSsoAction(null, fd)
    } else {
      await updateSsoAction(provider!.id, null, fd)
    }
  }

  const isSaml = provider?.providerType === 'saml'
  const isOidc = provider?.providerType === 'oidc'

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="providerType" value={provider?.providerType ?? 'saml'} />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">General</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FieldGroup>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="name">Provider name</FieldLabel>
                <input
                  id="name"
                  name="name"
                  required
                  defaultValue={provider?.name}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="e.g. Okta, Azure AD, Google Workspace"
                />
              </Field>
            </FieldGroup>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={provider?.isActive ?? true}
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="jitProvisioning"
                  defaultChecked={provider?.jitProvisioning ?? true}
                />
                JIT provisioning
              </label>
            </div>

            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="defaultRole">Default role</FieldLabel>
                <select
                  id="defaultRole"
                  name="defaultRole"
                  defaultValue={provider?.defaultRole ?? 'TEAM_MEMBER'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="TEAM_MEMBER">Team Member</option>
                  <option value="CLIENT">Client</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </Field>
              <Field>
                <FieldLabel htmlFor="spEntityId">SP Entity ID</FieldLabel>
                <input
                  id="spEntityId"
                  name="spEntityId"
                  defaultValue={provider?.spEntityId ?? 'urn:connectio:sso'}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading tracking-wide">
              {mode === 'create' ? 'Provider configuration' : isSaml ? 'SAML configuration' : 'OIDC configuration'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {/* The create form shows both tabs; edit shows the relevant one */}
            {(mode === 'create' || isSaml) && (
              <SAMLFields provider={provider} />
            )}
            {(mode === 'create' || isOidc) && (
              mode === 'create' ? (
                <div>
                  <SAMLFields provider={provider} />
                  <hr className="my-4" />
                  <p className="text-xs text-muted-foreground mb-3">
                    — OR —
                  </p>
                  <OIDCFields provider={provider} />
                </div>
              ) : (
                <OIDCFields provider={provider} />
              )
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <SubmitButton mode={mode} />
          <Button variant="outline" type="button" onClick={() => window.history.back()}>
            Cancel
          </Button>
        </div>

      </div>
    </form>
  )
}

function SAMLFields({ provider }: { provider?: SsoProviderDTO }) {
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="idpEntityId">IdP Entity ID</FieldLabel>
          <input
            id="idpEntityId"
            name="idpEntityId"
            defaultValue={provider?.idpEntityId ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="urn:example:idp"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="idpSsoUrl">IdP SSO URL</FieldLabel>
          <input
            id="idpSsoUrl"
            name="idpSsoUrl"
            defaultValue={provider?.idpSsoUrl ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="https://example.okta.com/app/..."
          />
        </Field>
      </FieldGroup>
      <Field>
        <FieldLabel htmlFor="idpCertificate">IdP Certificate (x509)</FieldLabel>
        <textarea
          id="idpCertificate"
          name="idpCertificate"
          defaultValue={provider?.idpCertificate ?? ''}
          rows={4}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          placeholder="-----BEGIN CERTIFICATE-----..."
        />
      </Field>
    </div>
  )
}

function OIDCFields({ provider }: { provider?: SsoProviderDTO }) {
  return (
    <div className="flex flex-col gap-4">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="oidcIssuer">OIDC Issuer URL</FieldLabel>
          <input
            id="oidcIssuer"
            name="oidcIssuer"
            defaultValue={provider?.oidcIssuer ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="https://accounts.google.com"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="oidcDiscoveryUrl">Discovery URL</FieldLabel>
          <input
            id="oidcDiscoveryUrl"
            name="oidcDiscoveryUrl"
            defaultValue={provider?.oidcDiscoveryUrl ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="https://accounts.google.com/.well-known/openid-configuration"
          />
        </Field>
      </FieldGroup>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="oidcClientId">Client ID</FieldLabel>
          <input
            id="oidcClientId"
            name="oidcClientId"
            defaultValue={provider?.oidcClientId ?? ''}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="oidcClientSecret">Client secret</FieldLabel>
          <input
              id="oidcClientSecret"
              name="oidcClientSecret"
              type="password"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Leave blank to keep current"
            />
        </Field>
      </FieldGroup>
    </div>
  )
}

function SubmitButton({ mode }: { mode: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : mode === 'create' ? 'Create provider' : 'Save changes'}
    </Button>
  )
}
