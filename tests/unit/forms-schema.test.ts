import { describe, expect, it } from 'vitest'
import { parseFormSchema } from '@/lib/forms/schema'

const validField = { name: 'projectName', label: 'Project name', type: 'text' as const }

describe('parseFormSchema', () => {
  it('accepts a minimal valid form', () => {
    const form = parseFormSchema({ version: 1, fields: [validField] })
    expect(form.fields).toHaveLength(1)
    expect(form.fields[0].required).toBe(false) // defaults to false
  })

  it('rejects the wrong schema version', () => {
    expect(() => parseFormSchema({ version: 2, fields: [validField] })).toThrow()
  })

  it('requires at least one field', () => {
    expect(() => parseFormSchema({ version: 1, fields: [] })).toThrow()
  })

  it('rejects an unknown field type', () => {
    expect(() =>
      parseFormSchema({ version: 1, fields: [{ ...validField, type: 'rating' }] }),
    ).toThrow()
  })

  it('rejects a field name with invalid characters', () => {
    expect(() =>
      parseFormSchema({ version: 1, fields: [{ ...validField, name: 'has space' }] }),
    ).toThrow()
  })

  it('requires at least one option for select/radio/checkbox/multiselect', () => {
    expect(() =>
      parseFormSchema({ version: 1, fields: [{ ...validField, type: 'select' }] }),
    ).toThrow()
    const ok = parseFormSchema({
      version: 1,
      fields: [
        { ...validField, type: 'select', options: [{ label: 'A', value: 'a' }] },
      ],
    })
    expect(ok.fields[0].options).toHaveLength(1)
  })

  it('enforces maxLength >= minLength', () => {
    expect(() =>
      parseFormSchema({
        version: 1,
        fields: [{ ...validField, type: 'text', minLength: 10, maxLength: 5 }],
      }),
    ).toThrow()
  })

  it('accepts up to 50 fields', () => {
    const fields = Array.from({ length: 50 }, (_, i) => ({
      name: `f${i}`,
      label: `F${i}`,
      type: 'text' as const,
    }))
    expect(parseFormSchema({ version: 1, fields }).fields).toHaveLength(50)
  })
})
