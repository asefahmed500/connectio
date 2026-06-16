'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createFormAction, updateFormAction, type FormEditorState } from './actions'
import { FieldListEditor, type FieldDef } from '@/components/forms/field-list-editor'
import type { FormSchemaV1 } from '@/lib/forms/schema'

function schemaToFields(schema: FormSchemaV1): FieldDef[] {
  return schema.fields.map((f) => ({
    key: f.name,
    label: f.label,
    type: f.type,
    required: f.required,
    help: f.help,
    options: f.options ? f.options.map((o) => ({ label: o.label, value: o.value })) : undefined,
  }))
}

function fieldsToSchema(title: string, fields: FieldDef[]): string {
  return JSON.stringify({
    version: 1,
    fields: fields.map((f) => ({
      name: f.key || f.label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      label: f.label,
      type: f.type,
      required: f.required ?? false,
      ...(f.help ? { help: f.help } : {}),
      ...(f.options?.length ? { options: f.options.map((o) => ({ label: o.label, value: o.value })) } : {}),
    })),
  } satisfies FormSchemaV1, null, 2)
}

export function FormEditor({
  mode,
  formId,
  initialTitle,
  initialDescription,
  initialSchema,
  initialIsActive,
}: {
  mode: 'create' | 'edit'
  formId?: string
  initialTitle?: string
  initialDescription?: string | null
  initialSchema?: FormSchemaV1
  initialIsActive?: boolean
}) {
  const router = useRouter()
  const [state, setState] = useState<FormEditorState>(undefined)
  const [pending, startTransition] = useTransition()
  const [schemaText, setSchemaText] = useState(() => {
    if (initialSchema) return JSON.stringify(initialSchema, null, 2)
    return ''
  })
  const [fields, setFields] = useState<FieldDef[]>(() =>
    initialSchema ? schemaToFields(initialSchema) : [],
  )
  const [useJson, setUseJson] = useState(false)
  const [title, setTitle] = useState(initialTitle ?? '')

  const syncFieldsToJson = useCallback(() => {
    setSchemaText(fieldsToSchema(title || 'Untitled', fields))
  }, [fields, title])

  async function onSubmit(formData: FormData) {
    const finalSchema = useJson ? schemaText : fieldsToSchema(title || 'Untitled', fields)
    formData.set('__schema', finalSchema)
    startTransition(async () => {
      if (mode === 'create') {
        const result = await createFormAction(undefined, formData)
        setState(result)
        if (result && 'success' in result && result.formId) {
          router.push(`/admin/forms/${result.formId}`)
        }
      } else if (formId) {
        const result = await updateFormAction(formId, undefined, formData)
        setState(result)
      }
    })
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project requirements"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          maxLength={280}
          defaultValue={initialDescription ?? ''}
          placeholder="What this form is for."
        />
      </div>

      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Form builder</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!useJson) syncFieldsToJson()
            setUseJson(!useJson)
          }}
        >
          {useJson ? 'Switch to structured editor' : 'Edit raw JSON'}
        </Button>
      </div>

      {useJson ? (
        <div className="flex flex-col gap-2">
          <Textarea
            name="schema"
            required
            rows={16}
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            className="font-mono text-xs"
            spellCheck={false}
            placeholder='{"version":1,"fields":[...]}'
          />
        </div>
      ) : (
        <FieldListEditor fields={fields} onChange={setFields} />
      )}

      {mode === 'edit' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={initialIsActive}
            className="h-4 w-4"
          />
          Active (visible to clients)
        </label>
      )}

      {state && 'error' in state && (
        <p className="text-sm text-destructive" role="alert">{state.error}</p>
      )}
      {state && 'fields' in state && state.fields && (
        <ul className="text-sm text-destructive list-disc pl-5 flex flex-col gap-1" role="alert">
          {Object.entries(state.fields).map(([k, v]) => (
            <li key={k}><code>{k}</code>: {(v as string[]).join(' ')}</li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>{mode === 'create' ? (pending ? 'Creating…' : 'Create form') : (pending ? 'Saving…' : 'Save changes')}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  )
}
