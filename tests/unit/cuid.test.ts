import { describe, expect, it } from 'vitest'
import { generateCuid } from '@/lib/cuid'

describe('generateCuid', () => {
  it('returns a non-empty lowercase-alphanumeric string', () => {
    const id = generateCuid()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(10)
    expect(id).toMatch(/^[a-z0-9]+$/)
  })

  it('generates unique values across many calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 5000; i++) seen.add(generateCuid())
    expect(seen.size).toBe(5000)
  })
})
