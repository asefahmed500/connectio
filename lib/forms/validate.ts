import 'server-only'
import { z } from 'zod'
import type { FormSchemaV1, FieldSchema } from './schema'

/**
 * Builds a Zod object schema dynamically from a FormSchemaV1 definition.
 * The server is the source of truth for validation; the client renders
 * inputs but never trusts its own validation.
 */
export function buildZodSchema(form: FormSchemaV1): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of form.fields) {
    shape[f.name] = fieldToZod(f)
  }
  return z.object(shape)
}

function fieldToZod(f: FieldSchema): z.ZodTypeAny {
  let s: z.ZodTypeAny
  switch (f.type) {
    case 'text': {
      let str = z.string().trim()
      if (f.minLength !== undefined) str = str.min(f.minLength)
      if (f.maxLength !== undefined) str = str.max(f.maxLength)
      s = str
      break
    }
    case 'textarea': {
      let str = z.string().trim()
      if (f.minLength !== undefined) str = str.min(f.minLength)
      if (f.maxLength !== undefined) str = str.max(f.maxLength)
      s = str
      break
    }
    case 'number': {
      let num = z.coerce.number()
      if (f.min !== undefined) num = num.min(f.min)
      if (f.max !== undefined) num = num.max(f.max)
      s = num
      break
    }
    case 'email':
      s = z.email()
      break
    case 'url':
      s = z.url()
      break
    case 'date':
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date (YYYY-MM-DD)')
      break
    case 'datetime':
      s = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, 'Enter a valid date and time')
      break
    case 'file':
      s = z.string().min(1, 'File is required')
      break
    case 'heading':
      s = z.literal('').optional()
      break
    case 'select':
    case 'radio': {
      const values = f.options!.map((o) => o.value) as [string, ...string[]]
      s = z.enum(values)
      break
    }
    case 'multiselect':
    case 'checkbox': {
      const values = f.options!.map((o) => o.value) as [string, ...string[]]
      s = z.array(z.enum(values))
      break
    }
    default:
      s = z.unknown()
  }

  return f.required ? s : z.optional(s.nullish())
}

export function validateSubmission(form: FormSchemaV1, data: unknown) {
  return buildZodSchema(form).safeParse(data)
}
