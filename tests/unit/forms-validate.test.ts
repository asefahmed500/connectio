import { describe, expect, it } from 'vitest'
import { validateSubmission } from '@/lib/forms/validate'
import type { FormSchemaV1 } from '@/lib/forms/schema'

// Fields are built loosely and cast: FieldSchema marks `required` as always
// present (it has a default), but for test ergonomics we omit it and cast.
const form = (fields: Array<Record<string, unknown>>): FormSchemaV1 =>
  ({ version: 1, fields }) as unknown as FormSchemaV1

describe('validateSubmission — required fields', () => {
  it('fails when a required field is missing', () => {
    const f = form([{ name: 'name', label: 'Name', type: 'text', required: true }])
    expect(validateSubmission(f, {}).success).toBe(false)
  })

  it('passes when a required field is present', () => {
    const f = form([{ name: 'name', label: 'Name', type: 'text', required: true }])
    expect(validateSubmission(f, { name: 'Jane' }).success).toBe(true)
  })

  it('passes when an optional field is omitted', () => {
    const f = form([{ name: 'nick', label: 'Nick', type: 'text' }])
    expect(validateSubmission(f, {}).success).toBe(true)
  })
})

describe('validateSubmission — field types', () => {
  it('coerces numeric strings to numbers', () => {
    const f = form([{ name: 'budget', label: 'Budget', type: 'number' }])
    const res = validateSubmission(f, { budget: '42' })
    expect(res.success).toBe(true)
    if (res.success) expect((res.data as { budget: number }).budget).toBe(42)
  })

  it('rejects an invalid email', () => {
    const f = form([{ name: 'email', label: 'Email', type: 'email', required: true }])
    expect(validateSubmission(f, { email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects an invalid url', () => {
    const f = form([{ name: 'site', label: 'Site', type: 'url', required: true }])
    expect(validateSubmission(f, { site: 'no protocol' }).success).toBe(false)
  })

  it('enforces number min/max bounds', () => {
    const f = form([{ name: 'n', label: 'N', type: 'number', min: 1, max: 10 }])
    expect(validateSubmission(f, { n: 0 }).success).toBe(false)
    expect(validateSubmission(f, { n: 11 }).success).toBe(false)
    expect(validateSubmission(f, { n: 5 }).success).toBe(true)
  })

  it('enforces text maxLength', () => {
    const f = form([{ name: 't', label: 'T', type: 'text', maxLength: 3 }])
    expect(validateSubmission(f, { t: 'abcd' }).success).toBe(false)
    expect(validateSubmission(f, { t: 'abc' }).success).toBe(true)
  })
})

describe('validateSubmission — choice fields', () => {
  const opts = [
    { label: 'Small', value: 's' },
    { label: 'Large', value: 'l' },
  ]

  it('select accepts a listed value and rejects an unlisted one', () => {
    const f = form([{ name: 'size', label: 'Size', type: 'select', options: opts }])
    expect(validateSubmission(f, { size: 's' }).success).toBe(true)
    expect(validateSubmission(f, { size: 'xl' }).success).toBe(false)
  })

  it('multiselect accepts arrays of listed values', () => {
    const f = form([{ name: 'tags', label: 'Tags', type: 'multiselect', options: opts }])
    expect(validateSubmission(f, { tags: ['s', 'l'] }).success).toBe(true)
    expect(validateSubmission(f, { tags: ['s', 'xx'] }).success).toBe(false)
  })
})
