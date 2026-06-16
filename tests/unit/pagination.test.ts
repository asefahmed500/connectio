import { describe, expect, it } from 'vitest'
import {
  paginationParams,
  toPaginated,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from '@/lib/dal/pagination'

describe('paginationParams', () => {
  it('defaults to page 1 / DEFAULT_PAGE_SIZE', () => {
    const { take, skip } = paginationParams()
    expect(take).toBe(DEFAULT_PAGE_SIZE)
    expect(skip).toBe(0)
  })

  it('computes skip from page + pageSize', () => {
    const { take, skip } = paginationParams({ page: 3, pageSize: 10 })
    expect(take).toBe(10)
    expect(skip).toBe(20)
  })

  it('clamps page <= 1 (negative/zero → 1)', () => {
    expect(paginationParams({ page: 0 }).skip).toBe(0)
    expect(paginationParams({ page: -5 }).skip).toBe(0)
  })

  it('clamps pageSize to [1, MAX_PAGE_SIZE]', () => {
    expect(paginationParams({ pageSize: 0 }).take).toBe(1)
    expect(paginationParams({ pageSize: -10 }).take).toBe(1)
    expect(paginationParams({ pageSize: 99999 }).take).toBe(MAX_PAGE_SIZE)
  })
})

describe('toPaginated', () => {
  it('computes totalPages and echoes page/pageSize', () => {
    const res = toPaginated(['a', 'b'], 45, { page: 2, pageSize: 10 })
    expect(res.total).toBe(45)
    expect(res.page).toBe(2)
    expect(res.pageSize).toBe(10)
    expect(res.totalPages).toBe(5) // ceil(45/10)
  })

  it('handles an exact-multiple total (no phantom last page)', () => {
    expect(toPaginated([], 20, { pageSize: 10 }).totalPages).toBe(2)
  })

  it('defaults page/pageSize when params omitted', () => {
    const res = toPaginated([], 0)
    expect(res.page).toBe(1)
    expect(res.pageSize).toBe(DEFAULT_PAGE_SIZE)
    expect(res.totalPages).toBe(0)
  })
})
