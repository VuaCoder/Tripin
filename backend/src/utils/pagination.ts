import { z } from 'zod';
import type { PaginationMeta } from './api-response';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/** Reusable zod fragment: spread into any list query schema. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export interface PageRequest {
  page: number;
  limit: number;
}

export interface Page<T> {
  items: T[];
  meta: PaginationMeta;
}

export function toSkip({ page, limit }: PageRequest): number {
  return (page - 1) * limit;
}

export function buildPage<T>(items: T[], total: number, { page, limit }: PageRequest): Page<T> {
  return { items, meta: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}
