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
    <div className="space-y-1.5">
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
          value={(value as string) ?? ''}
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
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          required={field.required}
          maxLength={field.maxLength}
          rows={6}
        />
      )

    case 'select':
      return (
        <Select
          value={(value as string) ?? ''}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          <SelectTrigger id={id}>
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {field.options!.map((o) => (
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
          value={(value as string) ?? ''}
          onValueChange={(v) => onChange(v)}
          disabled={disabled}
        >
          {field.options!.map((o) => (
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
        <div className="space-y-2">
          {field.options!.map((o) => {
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
