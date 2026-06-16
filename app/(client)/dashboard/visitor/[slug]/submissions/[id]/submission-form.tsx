'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldRenderer, type FieldValue } from '@/components/forms/field-renderer'
import { saveDraftAction, submitAction, type SubmissionFormState } from './actions'
import type { FormSchemaV1 } from '@/lib/forms/schema'
import type { SubmissionStatus } from '@prisma/client'

export function SubmissionForm({
  submissionId,
  clientId,
  formId,
  schema,
  initialData,
  canEdit,
  status,
}: {
  submissionId: string
  clientId: string
  formId: string
  schema: FormSchemaV1
  initialData: Record<string, unknown>
  canEdit: boolean
  status: SubmissionStatus
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, FieldValue>>(() => {
    const init: Record<string, FieldValue> = {}
    for (const f of schema.fields) {
      const v = initialData[f.name]
      init[f.name] = Array.isArray(v) ? (v as string[]) : (v as FieldValue)
    }
    return init
  })
  const [state, formAction, pending] = useActionState<SubmissionFormState, FormData>(
    submitAction,
    undefined,
  )
  const [saved, setSaved] = useState<string | null>(null)

  function handleChange(name: string, value: FieldValue) {
    setValues((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSaveDraft() {
    const result = await saveDraftAction({
      submissionId,
      clientId,
      formId,
      formData: values,
    })
    if (result.success) {
      setSaved(new Date().toLocaleTimeString())
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!canEdit && (
        <div className="border-l-4 border-amber-400 bg-amber-50 p-3 text-sm rounded-r-md">
          This submission is <strong>{status.replace('_', ' ').toLowerCase()}</strong> and
          can&apos;t be edited. Contact your account team if changes are needed.
        </div>
      )}

      <form action={formAction} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="submissionId" value={submissionId} />
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="formId" value={formId} />
        <input type="hidden" name="formData" value={JSON.stringify(values)} />

        {schema.fields.map((field) => (
          <FieldRenderer
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(v) => handleChange(field.name, v)}
            disabled={!canEdit || pending}
          />
        ))}

        {state && 'error' in state && state.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}
        {state && 'fields' in state && state.fields && (
          <ul className="text-sm text-destructive list-disc pl-5 flex flex-col gap-1" role="alert">
            {Object.entries(state.fields).map(([k, v]) => (
              <li key={k}>
                <code>{k}</code>: {(v as string[]).join(' ')}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Submitting…' : 'Submit for review'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={pending}
            >
              Save draft
            </Button>
            {saved && (
              <span className="text-xs text-muted-foreground self-center">
                Saved at {saved}
              </span>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
