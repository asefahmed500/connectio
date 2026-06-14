import { describe, expect, it } from 'vitest'
import { slugify, isValidSlug, isReservedSlug, randomSlug } from '@/lib/slug'

describe('slugify', () => {
  it('lowercases and replaces non-alphanumerics with hyphens', () => {
    expect(slugify('Jane Smith')).toBe('jane-smith')
    expect(slugify('  Acme  Corp  ')).toBe('acme-corp')
    expect(slugify('Joe O\'Brien')).toBe('joe-o-brien')
  })

  it('collapses runs of separators', () => {
    expect(slugify('A___B')).toBe('a-b')
    expect(slugify('A   B')).toBe('a-b')
    expect(slugify('A---B')).toBe('a-b')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('---abc---')).toBe('abc')
    expect(slugify('  hi  ')).toBe('hi')
  })

  it('truncates to 32 chars', () => {
    expect(slugify('a'.repeat(50))).toHaveLength(32)
  })

  it('handles unicode gracefully (strips to ASCII)', () => {
    expect(slugify('Café Résumé')).toBe('caf-r-sum')
  })

  it('returns empty for input with no slugifiable chars', () => {
    expect(slugify('!!!@##$$')).toBe('')
  })
})

describe('isValidSlug', () => {
  it('accepts a clean slug', () => {
    expect(isValidSlug('acme-corp')).toBe(true)
    expect(isValidSlug('abc')).toBe(true)
    expect(isValidSlug('a-b-c-1-2-3')).toBe(true)
  })

  it('rejects too-short slugs', () => {
    expect(isValidSlug('ab')).toBe(false)
  })

  it('rejects too-long slugs', () => {
    expect(isValidSlug('a'.repeat(33))).toBe(false)
  })

  it('rejects uppercase', () => {
    expect(isValidSlug('Acme')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(isValidSlug('acme_corp')).toBe(false)
    expect(isValidSlug('acme.corp')).toBe(false)
    expect(isValidSlug('acme corp')).toBe(false)
  })

  it('rejects reserved words', () => {
    expect(isValidSlug('admin')).toBe(false)
    expect(isValidSlug('api')).toBe(false)
    expect(isValidSlug('login')).toBe(false)
  })
})

describe('isReservedSlug', () => {
  it('flags known reserved words', () => {
    expect(isReservedSlug('admin')).toBe(true)
    expect(isReservedSlug('ADMIN')).toBe(true)
    expect(isReservedSlug('Admin')).toBe(true)
  })

  it('passes non-reserved slugs', () => {
    expect(isReservedSlug('acme')).toBe(false)
  })
})

describe('randomSlug', () => {
  it('produces a slug of the requested length', () => {
    expect(randomSlug(8)).toHaveLength(8)
    expect(randomSlug(12)).toHaveLength(12)
  })

  it('only uses [a-z0-9]', () => {
    const s = randomSlug(100)
    expect(s).toMatch(/^[a-z0-9]+$/)
  })

  it('produces unique outputs across many calls', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 1000; i++) seen.add(randomSlug(8))
    // 36^8 ≈ 2.8e12 — collisions are vanishingly rare at 1000 samples.
    expect(seen.size).toBeGreaterThan(990)
  })
})
