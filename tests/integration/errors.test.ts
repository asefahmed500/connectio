import { describe, expect, it } from 'vitest'
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TransitionError,
  RateLimitError,
  AppError,
} from '@/lib/errors'

describe('error classes', () => {
  it('ValidationError carries fields and 400 status', () => {
    const err = new ValidationError({ email: ['Required'] })
    expect(err.httpStatus).toBe(400)
    expect(err.code).toBe('VALIDATION')
    expect(err.fields?.email).toEqual(['Required'])
  })

  it('UnauthorizedError has 401 status', () => {
    const err = new UnauthorizedError()
    expect(err.httpStatus).toBe(401)
  })

  it('ForbiddenError has 403 status', () => {
    const err = new ForbiddenError()
    expect(err.httpStatus).toBe(403)
  })

  it('NotFoundError includes resource name', () => {
    const err = new NotFoundError('User')
    expect(err.httpStatus).toBe(404)
    expect(err.message).toContain('User')
  })

  it('ConflictError has 409 status', () => {
    const err = new ConflictError('Already exists')
    expect(err.httpStatus).toBe(409)
  })

  it('TransitionError shows from→to', () => {
    const err = new TransitionError('DRAFT', 'APPROVED')
    expect(err.httpStatus).toBe(422)
    expect(err.message).toContain('DRAFT')
    expect(err.message).toContain('APPROVED')
  })

  it('RateLimitError carries retryAfter and 429 status', () => {
    const err = new RateLimitError(30)
    expect(err.httpStatus).toBe(429)
    expect(err.retryAfter).toBe(30)
  })

  it('all errors extend AppError', () => {
    expect(new ValidationError({})).toBeInstanceOf(AppError)
    expect(new UnauthorizedError()).toBeInstanceOf(AppError)
    expect(new NotFoundError('X')).toBeInstanceOf(AppError)
    expect(new RateLimitError(1)).toBeInstanceOf(AppError)
  })
})
