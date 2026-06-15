import 'server-only'

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export type PaginatedResult<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginationParams {
  page?: number
  pageSize?: number
}

export function paginationParams(input?: PaginationParams): { take: number; skip: number } {
  const page = Math.max(1, input?.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input?.pageSize ?? DEFAULT_PAGE_SIZE))
  return { take: pageSize, skip: (page - 1) * pageSize }
}

export function toPaginated<T>(
  items: T[],
  total: number,
  params?: PaginationParams,
): PaginatedResult<T> {
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params?.pageSize ?? DEFAULT_PAGE_SIZE))
  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
