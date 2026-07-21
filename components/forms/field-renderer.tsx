'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { FieldSchema } from '@/lib/forms/schema'

export type FieldValue = string | number | string[] | undefined

interface FieldRendererProps {
  field: FieldSchema
  value: FieldValue
  onChange: (value: FieldValue) => void
  disabled?: boolean
}

export function FieldRenderer({ field, value, onChange, disabled }: FieldRendererProps) {
  const id = `field-${field.name}`

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {renderField(field, id, value, onChange, disabled)}

      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
    </div>
  )
}

function renderField(
  field: FieldSchema,
  id: string,
  value: FieldValue,
  onChange: (v: FieldValue) => void,
  disabled?: boolean,
) {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
      return (
        <Input
          id={id}
          type={field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
          value={typeof value === 'string' ? value : value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          required={field.required}
          maxLength={field.maxLength}
        />
      )

    case 'number':
      return (
        <Input
          id={id}
          type="number"
          value={value === undefined ? '' : String(value)}
          onChange={(e) =>
            onChange(e.target.value === '' ? undefined : Number(e.target.value))
          }
          disabled={disabled}
          required={field.required}
          min={field.min}
          max={field.max}
        />
      )

    case 'textarea':
      return (
        <Textarea
          id={id}
          value={typeof value === 'string' ? value : value === undefined ? '' : String(value)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          required={field.required}
          minLength={field.minLength}
          maxLength={field.maxLength}
          rows={6}
        />
      )

    case 'date':
      return (
        <Input
          id={id}
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={field.required}
        />
      )

    case 'datetime':
      return (
        <Input
          id={id}
          type="datetime-local"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          required={field.required}
        />
      )

    case 'file':
      // NOTE: the file field type is not yet wired to the upload pipeline.
      // Previously this component stored only the filename string in form
      // state, which then got serialized as a regular text value on submit —
      // silently losing the actual File object. Until real multipart upload
      // support is added, surface this clearly to the user instead of
      // pretending the upload succeeded.
      return (
        <div
          id={id}
          className="rounded-md border border-dashed border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200"
          role="note"
        >
          <strong>File upload is not yet available.</strong>{' '}
          Please contact your account team to send files via the Files section of your portal.
        </div>
      )

    case 'heading':
      return (
        <div className="pt-2 pb-1">
          <h3 className="text-lg font-semibold">{field.label}</h3>
          {field.help && <p className="text-sm text-muted-foreground mt-0.5">{field.help}</p>}
        </div>
      )

    case 'select':
      return (
        <Select
          value={typeof value === 'string' ? value : ''}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )

    case 'radio':
      return (
        <RadioGroup
          value={typeof value === 'string' ? value : ''}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          {(field.options ?? []).map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}-${o.value}`} value={o.value} />
              <Label htmlFor={`${id}-${o.value}`}>{o.label}</Label>
            </div>
          ))}
        </RadioGroup>
      )

    case 'multiselect':
    case 'checkbox': {
      const selected = (value as string[] | undefined) ?? []
      return (
        <div className="flex flex-col gap-2">
          {(field.options ?? []).map((o) => {
            const checked = selected.includes(o.value)
            return (
              <div key={o.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${o.value}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    if (c) onChange([...selected, o.value])
                    else onChange(selected.filter((v) => v !== o.value))
                  }}
                  disabled={disabled}
                />
                <Label htmlFor={`${id}-${o.value}`}>{o.label}</Label>
              </div>
            )
          })}
        </div>
      )
    }

    default:
      return <p className="text-xs text-destructive">Unsupported field type: {field.type}</p>
  }
}
