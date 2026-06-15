import { describe, expect, it } from 'vitest'
import { slugify, isValidSlug, isReservedSlug, randomSlug } from '@/lib/slug'

describe('slugify — edge cases', () => {
  it('handles empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('handles only separators', () => {
    expect(slugify('---')).toBe('')
  })

  it('preserves numbers', () => {
    expect(slugify('Company 2 Inc')).toBe('company-2-inc')
  })

  it('handles long names with truncation', () => {
    const result = slugify('a'.repeat(100))
    expect(result).toHaveLength(32)
  })

  it('handles mixed case and symbols', () => {
    expect(slugify('ACME Corp. (USA)')).toBe('acme-corp-usa')
  })
})

describe('randomSlug — collision resistance', () => {
  it('generates 1000 slugs without collisions', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      const s = randomSlug(8)
      expect(seen.has(s)).toBe(false)
      seen.add(s)
    }
  })

  it('respects character set — only lowercase and digits', () => {
    for (let i = 0; i < 100; i++) {
      expect(randomSlug(12)).toMatch(/^[a-z0-9]+$/)
    }
  })
})
