'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createFormAction, updateFormAction, type FormEditorState } from './actions'
import type { FormSchemaV1 } from '@/lib/forms/schema'

function toDisplay(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
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
  const [schemaText, setSchemaText] = useState(toDisplay(initialSchema))

  async function onSubmit(formData: FormData) {
    formData.set('__schema', schemaText)
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
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          defaultValue={initialTitle}
          placeholder="Project requirements"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          name="description"
          maxLength={280}
          defaultValue={initialDescription ?? ''}
          placeholder="What this form is for."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="schema">Form schema (JSON)</Label>
        <Textarea
          id="schema"
          name="schema"
          required
          rows={16}
          value={schemaText}
          onChange={(e) => setSchemaText(e.target.value)}
          className="font-mono text-xs"
          spellCheck={false}
        />
        <p className="text-xs text-muted-foreground">
          See <code>docs/05-forms-and-submissions.md</code> for the schema format. A drag-and-drop
          builder is planned; for now edit JSON directly.
        </p>
      </div>

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
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      {state && 'fields' in state && state.fields && (
        <ul className="text-sm text-destructive list-disc pl-5 space-y-1" role="alert">
          {Object.entries(state.fields).map(([k, v]) => (
            <li key={k}>
              <code>{k}</code>: {(v as string[]).join(' ')}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <Button type="submit">{mode === 'create' ? 'Create form' : 'Save changes'}</Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
