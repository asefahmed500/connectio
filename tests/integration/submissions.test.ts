import { describe, expect, it } from 'vitest'
import { canTransition } from '@/lib/dal/submissions'
import type { SubmissionStatus } from '@prisma/client'

describe('canTransition — submission state machine', () => {
  it('allows DRAFT → SUBMITTED', () => {
    expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true)
  })

  it('rejects DRAFT → APPROVED', () => {
    expect(canTransition('DRAFT', 'APPROVED')).toBe(false)
  })

  it('allows SUBMITTED → IN_REVIEW', () => {
    expect(canTransition('SUBMITTED', 'IN_REVIEW')).toBe(true)
  })

  it('allows SUBMITTED → CHANGES_REQUESTED', () => {
    expect(canTransition('SUBMITTED', 'CHANGES_REQUESTED')).toBe(true)
  })

  it('allows SUBMITTED → APPROVED', () => {
    expect(canTransition('SUBMITTED', 'APPROVED')).toBe(true)
  })

  it('allows SUBMITTED → REJECTED', () => {
    expect(canTransition('SUBMITTED', 'REJECTED')).toBe(true)
  })

  it('allows IN_REVIEW → APPROVED', () => {
    expect(canTransition('IN_REVIEW', 'APPROVED')).toBe(true)
  })

  it('allows IN_REVIEW → REJECTED', () => {
    expect(canTransition('IN_REVIEW', 'REJECTED')).toBe(true)
  })

  it('allows IN_REVIEW → CHANGES_REQUESTED', () => {
    expect(canTransition('IN_REVIEW', 'CHANGES_REQUESTED')).toBe(true)
  })

  it('allows CHANGES_REQUESTED → SUBMITTED', () => {
    expect(canTransition('CHANGES_REQUESTED', 'SUBMITTED')).toBe(true)
  })

  it('rejects CHANGES_REQUESTED → APPROVED', () => {
    expect(canTransition('CHANGES_REQUESTED', 'APPROVED')).toBe(false)
  })

  it('rejects APPROVED → anything (terminal)', () => {
    const statuses: SubmissionStatus[] = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED']
    for (const s of statuses) {
      expect(canTransition('APPROVED', s)).toBe(false)
    }
  })

  it('rejects REJECTED → anything (terminal)', () => {
    const statuses: SubmissionStatus[] = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'REJECTED']
    for (const s of statuses) {
      expect(canTransition('REJECTED', s)).toBe(false)
    }
  })
})
