export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MIN_LIMIT: 1,
  MAX_LIMIT: 100,
  MAX_PAGE: 10000,
} as const;

export interface PaginationInput {
  page?: number;
  limit?: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export function normalizePagination(input: PaginationInput): PaginationResult {
  let page = input.page ?? PAGINATION.DEFAULT_PAGE;
  let limit = input.limit ?? PAGINATION.DEFAULT_LIMIT;

  // clamp page
  page = Math.max(1, Math.min(page, PAGINATION.MAX_PAGE));

  // clamp limit
  limit = Math.max(PAGINATION.MIN_LIMIT, Math.min(limit, PAGINATION.MAX_LIMIT));

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

export function createPaginationMeta(
  page: number,
  limit: number,
  total: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}
