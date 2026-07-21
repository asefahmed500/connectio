'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, ChevronUp, ChevronDown, Copy, Eye, EyeOff } from 'lucide-react'

export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'email' | 'url' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'date' | 'datetime' | 'file' | 'heading'
  required?: boolean
  help?: string
  placeholder?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  options?: { label: string; value: string }[]
}

const FIELD_TYPES: { value: FieldDef['type']; label: string; icon: string }[] = [
  { value: 'text', label: 'Short text', icon: 'Aa' },
  { value: 'textarea', label: 'Long text', icon: '\u2191\u2193' },
  { value: 'number', label: 'Number', icon: '#+' },
  { value: 'email', label: 'Email', icon: '@' },
  { value: 'url', label: 'URL', icon: '\u2197' },
  { value: 'date', label: 'Date', icon: '\u2633' },
  { value: 'datetime', label: 'Date & time', icon: '\u23F0' },
  { value: 'file', label: 'File upload', icon: '\u2191' },
  { value: 'select', label: 'Dropdown', icon: '\u2261' },
  { value: 'multiselect', label: 'Multi-select', icon: '\u2611' },
  { value: 'radio', label: 'Radio buttons', icon: '\u25CB' },
  { value: 'checkbox', label: 'Checkbox', icon: '\u2713' },
  { value: 'heading', label: 'Section heading', icon: 'H' },
]

function emptyField(): FieldDef {
  return { key: '', label: '', type: 'text', required: false }
}

function fieldKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
}

function FieldPreview({ field }: { field: FieldDef }) {
  if (field.type === 'heading') {
    return (
      <div className="border-t pt-3 mt-3 flex flex-col gap-1">
        <span className="text-lg font-semibold">{field.label || 'Section heading'}</span>
        {field.help && <span className="text-sm text-muted-foreground">{field.help}</span>}
      </div>
    )
  }

  return (
    <div className="border rounded-lg p-4 flex flex-col gap-2 bg-card">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium">{field.label || 'Untitled field'}</span>
        {field.required && <span className="text-destructive text-sm">*</span>}
        <Badge variant="outline" className="ml-auto text-xs font-mono">{field.type}</Badge>
      </div>
      {field.help && <span className="text-xs text-muted-foreground">{field.help}</span>}
      {field.type === 'textarea' ? (
        <div className="h-16 rounded-md border bg-muted/30" />
      ) : field.type === 'file' ? (
        <div className="h-10 rounded-md border border-dashed bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Upload file</div>
      ) : field.type === 'select' || field.type === 'radio' ? (
        <div className="flex flex-col gap-1.5">
          {field.options?.map((o, i) => (
            <div key={i} className="h-5 rounded border bg-muted/20 text-xs px-2 flex items-center">{o.label}</div>
          ))}
        </div>
      ) : field.type === 'multiselect' || field.type === 'checkbox' ? (
        <div className="flex flex-col gap-1.5">
          {field.options?.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="size-4 rounded border border-muted-foreground/30" />
              <span className="text-xs">{o.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="h-8 rounded-md border bg-muted/20" />
      )}
    </div>
  )
}

export function FieldListEditor({
  fields,
  onChange,
}: {
  fields: FieldDef[]
  onChange: (fields: FieldDef[]) => void
}) {
  const addField = () => onChange([...fields, emptyField()])

  const updateField = (index: number, patch: Partial<FieldDef>) => {
    const updated = fields.map((f, i) => (i === index ? { ...f, ...patch } : f))
    if (patch.label !== undefined) {
      const generated = fieldKey(patch.label)
      if (generated && !updated[index].key) {
        updated[index] = { ...updated[index], key: generated }
      }
    }
    onChange(updated)
  }

  const removeField = (index: number) => onChange(fields.filter((_, i) => i !== index))

  const duplicateField = (index: number) => {
    const copy = { ...fields[index], key: '' }
    const updated = [...fields]
    updated.splice(index + 1, 0, copy)
    onChange(updated)
  }

  const moveField = (index: number, direction: -1 | 1) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= fields.length) return
    const updated = [...fields]
    ;[updated[index], updated[newIndex]] = [updated[newIndex], updated[index]]
    onChange(updated)
  }

  const needsOptions = (type: FieldDef['type']) =>
    type === 'select' || type === 'multiselect' || type === 'radio'

  const needsValidation = (type: FieldDef['type']) =>
    type === 'text' || type === 'textarea' || type === 'number'

  const addOption = (index: number) => {
    const field = fields[index]
    const options = field.options ?? []
    updateField(index, { options: [...options, { label: '', value: '' }] })
  }

  const updateOption = (fieldIndex: number, optIndex: number, label: string) => {
    const options = [...(fields[fieldIndex].options ?? [])]
    options[optIndex] = { label, value: label.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') }
    updateField(fieldIndex, { options })
  }

  const removeOption = (fieldIndex: number, optIndex: number) => {
    const options = fields[fieldIndex].options?.filter((_, i) => i !== optIndex) ?? []
    updateField(fieldIndex, { options: options.length ? options : undefined })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Form fields</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus data-icon="inline-start" /> Add field
        </Button>
      </div>

      {fields.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">No fields yet.</span>
            <span className="text-xs text-muted-foreground">
              Click &ldquo;Add field&rdquo; to start building your form.
            </span>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2" data-field-list>
            {fields.map((field, index) => (
              <div
                key={field.key || `f-${index}`}
                className="border rounded-lg p-3 flex flex-col gap-2 bg-card hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums w-5 shrink-0">{index + 1}</span>
                  <div className="flex-1">
                    <Input
                      placeholder="Field label"
                      value={field.label}
                      onChange={(e) => updateField(index, { label: e.target.value })}
                    />
                  </div>
                  <Select
                    value={field.type}
                    onValueChange={(v) => updateField(index, { type: v as FieldDef['type'] })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map((ft) => (
                        <SelectItem key={ft.value} value={ft.value}>
                          {ft.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => moveField(index, -1)} aria-label="Move up">
                      <ChevronUp data-icon="inline-start" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" disabled={index === fields.length - 1} onClick={() => moveField(index, 1)} aria-label="Move down">
                      <ChevronDown data-icon="inline-start" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => duplicateField(index)} aria-label="Duplicate field">
                      <Copy data-icon="inline-start" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeField(index)} aria-label="Remove field">
                      <Trash2 data-icon="inline-start" className="text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-7">
                  <div className="flex items-center gap-1.5">
                    <Checkbox
                      id={`required-${index}`}
                      checked={field.required}
                      onCheckedChange={(c) => updateField(index, { required: !!c })}
                    />
                    <Label htmlFor={`required-${index}`} className="text-xs cursor-pointer">Required</Label>
                  </div>
                  <Input
                    placeholder="Help text"
                    value={field.help ?? ''}
                    onChange={(e) => updateField(index, { help: e.target.value || undefined })}
                    className="h-7 text-xs flex-1 min-w-[120px] max-w-[200px]"
                  />
                  <Input
                    placeholder="Field key"
                    value={field.key}
                    onChange={(e) => updateField(index, { key: e.target.value })}
                    className="h-7 text-xs font-mono w-28"
                  />
                  <Input
                    placeholder="Placeholder"
                    value={field.placeholder ?? ''}
                    onChange={(e) => updateField(index, { placeholder: e.target.value || undefined })}
                    className="h-7 text-xs w-28"
                  />
                </div>

                {needsValidation(field.type) && (
                  <div className="flex flex-wrap items-center gap-2 pl-7">
                    {field.type === 'text' || field.type === 'textarea' ? (
                      <>
                        <Input
                          type="number" min={0} max={10000}
                          placeholder="Min chars"
                          value={field.minLength ?? ''}
                          onChange={(e) => updateField(index, { minLength: e.target.value ? Number(e.target.value) : undefined })}
                          className="h-7 text-xs w-24"
                        />
                        <Input
                          type="number" min={0} max={10000}
                          placeholder="Max chars"
                          value={field.maxLength ?? ''}
                          onChange={(e) => updateField(index, { maxLength: e.target.value ? Number(e.target.value) : undefined })}
                          className="h-7 text-xs w-24"
                        />
                      </>
                    ) : null}
                    {field.type === 'number' ? (
                      <>
                        <Input
                          type="number"
                          placeholder="Min value"
                          value={field.min ?? ''}
                          onChange={(e) => updateField(index, { min: e.target.value ? Number(e.target.value) : undefined })}
                          className="h-7 text-xs w-24"
                        />
                        <Input
                          type="number"
                          placeholder="Max value"
                          value={field.max ?? ''}
                          onChange={(e) => updateField(index, { max: e.target.value ? Number(e.target.value) : undefined })}
                          className="h-7 text-xs w-24"
                        />
                      </>
                    ) : null}
                  </div>
                )}

                {needsOptions(field.type) && (
                  <div className="pl-7 flex flex-col gap-1.5">
                    {field.options?.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground w-4">{oi + 1}.</span>
                        <Input
                          placeholder={`Option ${oi + 1}`}
                          value={opt.label}
                          onChange={(e) => updateOption(index, oi, e.target.value)}
                          className="h-7 text-xs flex-1"
                        />
                        <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeOption(index, oi)} aria-label="Remove option">
                          <Trash2 className="size-3 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => addOption(index)} className="self-start h-7 text-xs">
                      <Plus data-icon="inline-start" /> Add option
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 lg:border-l lg:pl-4">
            <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <Eye data-icon="inline-start" className="size-4" /> Preview
            </div>
            <div className="flex flex-col gap-1">
              {fields.map((field, i) => (
                <FieldPreview key={field.key || `fp-${i}`} field={field} />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
