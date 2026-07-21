'use client'

import { useActionState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { saveSettingsAction, type SettingsState } from './actions'
import type { SettingKey } from '@/lib/dal/settings'

type SettingsMap = Record<SettingKey, { value: string; definition: {
  label: string
  description: string
  type: 'boolean' | 'text' | 'number'
  default: string
  min?: number
  max?: number
} }>

export function GeneralSettingsForm({ settings }: { settings: SettingsMap }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(
    saveSettingsAction,
    undefined,
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-heading tracking-wide">General settings</CardTitle>
        <CardDescription>
          Runtime-configurable system settings. Changes take effect immediately.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-5">
          {state && 'error' in state && (
            <Alert variant="destructive">
              <AlertDescription role="alert">{state.error}</AlertDescription>
            </Alert>
          )}
          {state && 'success' in state && (
            <Alert className="border-emerald-500/40 bg-emerald-500/5">
              <AlertDescription role="status">Settings saved.</AlertDescription>
            </Alert>
          )}

          {(Object.keys(settings) as SettingKey[]).map((key) => {
            const { value, definition } = settings[key]
            return (
              <Field key={key}>
                <FieldLabel htmlFor={`setting-${key}`}>{definition.label}</FieldLabel>
                <FieldDescription>{definition.description}</FieldDescription>
                {definition.type === 'boolean' && (
                  <div className="flex items-center gap-2 mt-2">
                    <Switch
                      id={`setting-${key}`}
                      name={key}
                      defaultChecked={value === 'true'}
                    />
                    <span className="text-xs text-muted-foreground">
                      {value === 'true' ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                )}
                {definition.type === 'number' && (
                  <Input
                    id={`setting-${key}`}
                    name={key}
                    type="number"
                    defaultValue={value}
                    min={definition.min}
                    max={definition.max}
                    className="max-w-[180px]"
                  />
                )}
                {definition.type === 'text' && (
                  <Textarea
                    id={`setting-${key}`}
                    name={key}
                    defaultValue={value}
                    rows={2}
                  />
                )}
              </Field>
            )
          })}

          <div>
            <Button type="submit" disabled={pending}>
              {pending ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
