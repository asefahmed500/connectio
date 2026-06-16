'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Trash2, GripVertical } from 'lucide-react'

export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'textarea' | 'number' | 'email' | 'url' | 'select' | 'multiselect' | 'radio' | 'checkbox'
  required?: boolean
  help?: string
  options?: { label: string; value: string }[]
}

const FIELD_TYPES: { value: FieldDef['type']; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Textarea' },
  { value: 'number', label: 'Number' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'select', label: 'Select (dropdown)' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'radio', label: 'Radio group' },
  { value: 'checkbox', label: 'Checkbox' },
]

function emptyField(): FieldDef {
  return { key: '', label: '', type: 'text', required: false }
}

function fieldKey(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
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
    // Auto-generate key from label
    if (patch.label !== undefined) {
      const generated = fieldKey(patch.label)
      if (generated && !updated[index].key) {
        updated[index] = { ...updated[index], key: generated }
      }
    }
    onChange(updated)
  }

  const removeField = (index: number) => {
    onChange(fields.filter((_, i) => i !== index))
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

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Form fields</Label>
        <Button type="button" variant="outline" size="sm" onClick={addField}>
          <Plus data-icon="inline-start" /> Add field
        </Button>
      </div>

      {fields.length === 0 && (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
          No fields yet. Click &ldquo;Add field&rdquo; to start building your form.
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2">
        {fields.map((field, index) => (
          <div key={field.key || `field-${index}`} className="border rounded-lg p-3 flex flex-col gap-2 bg-muted/10">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums w-5">{index + 1}</span>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Field label"
                  value={field.label}
                  onChange={(e) => updateField(index, { label: e.target.value })}
                  className="sm:col-span-2"
                />
                <Select
                  value={field.type}
                  onValueChange={(v) => updateField(index, { type: v as FieldDef['type'] })}
                >
                  <SelectTrigger>
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
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={index === 0}
                  onClick={() => moveField(index, -1)}
                  aria-label="Move up"
                >
                  <GripVertical data-icon="inline-start" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeField(index)}
                  aria-label="Remove field"
                >
                  <Trash2 data-icon="inline-start" className="text-destructive" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3 pl-7">
              <div className="flex items-center gap-1.5">
                <Checkbox
                  id={`required-${index}`}
                  checked={field.required}
                  onCheckedChange={(c) => updateField(index, { required: !!c })}
                />
                <Label htmlFor={`required-${index}`} className="text-xs cursor-pointer">
                  Required
                </Label>
              </div>
              <Input
                placeholder="Help text (optional)"
                value={field.help ?? ''}
                onChange={(e) => updateField(index, { help: e.target.value || undefined })}
                className="h-7 text-xs flex-1 max-w-xs"
              />
              <Input
                placeholder="Field key"
                value={field.key}
                onChange={(e) => updateField(index, { key: e.target.value })}
                className="h-7 text-xs font-mono w-32"
              />
            </div>

            {needsOptions(field.type) && (
              <div className="pl-7">
                <Input
                  placeholder="Options (comma separated, e.g. Small, Medium, Large)"
                  value={field.options?.map((o) => o.label).join(', ') ?? ''}
                  onChange={(e) => {
                    const labels = e.target.value.split(',').map((s) => s.trim()).filter(Boolean)
                    updateField(index, {
                      options: labels.map((label) => ({ label, value: label.toLowerCase().replace(/[^a-z0-9_-]+/g, '-') })),
                    })
                  }}
                  className="h-7 text-xs"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
