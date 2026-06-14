import { z } from 'zod'

// See docs/05-forms-and-submissions.md.
// Adding a new field type means updating: this file, validate.ts, and the
// client-side FieldRenderer component. No plugin system by design.

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'url',
  'select',
  'multiselect',
  'radio',
  'checkbox',
] as const

export type FieldType = (typeof FIELD_TYPES)[number]

const FIELD_NAME_RE = /^[a-z0-9_]+$/i
const OPTION_VALUE_RE = /^[a-z0-9_-]+$/i

export const FieldOption = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(1).max(60).regex(OPTION_VALUE_RE),
})
export type FieldOption = z.infer<typeof FieldOption>

export const FieldSchema = z
  .object({
    name: z.string().min(1).max(60).regex(FIELD_NAME_RE),
    label: z.string().min(1).max(120),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().default(false),
    help: z.string().max(280).optional(),
    placeholder: z.string().max(120).optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(FieldOption).optional(),
  })
  .refine(
    (f) => !['select', 'multiselect', 'radio', 'checkbox'].includes(f.type) || (f.options?.length ?? 0) >= 1,
    { message: 'This field type requires at least one option', path: ['options'] },
  )
  .refine((f) => f.maxLength === undefined || f.minLength === undefined || f.maxLength >= f.minLength, {
    message: 'maxLength must be ≥ minLength',
    path: ['maxLength'],
  })
  .refine((f) => f.max === undefined || f.min === undefined || f.max >= f.min, {
    message: 'max must be ≥ min',
    path: ['max'],
  })
export type FieldSchema = z.infer<typeof FieldSchema>

export const FormSchemaV1 = z.object({
  version: z.literal(1),
  fields: z.array(FieldSchema).min(1, 'At least one field is required').max(50),
})
export type FormSchemaV1 = z.infer<typeof FormSchemaV1>

export function parseFormSchema(raw: unknown): FormSchemaV1 {
  return FormSchemaV1.parse(raw)
}
