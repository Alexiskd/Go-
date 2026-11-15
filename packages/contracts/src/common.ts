import { s, type Infer } from '@go-/shared';
import { ERROR_CODES, type ErrorCode } from '@go-/types';

export const API_VERSIONS = ['v1'] as const;
export type ApiVersion = (typeof API_VERSIONS)[number];

/** Erreur normalisée renvoyée par toute API GO-. */
export const ApiErrorSchema = s.object({
  code: s.enum(Object.keys(ERROR_CODES) as ErrorCode[]),
  message: s.string(),
  status: s.number().int(),
  details: s.unknown().optional(),
  requestId: s.string().optional(),
}).title('ApiError');
export type ApiError = Infer<typeof ApiErrorSchema>;

export const IdParams = s.object({ id: s.string().uuid() });

export const PaginationQuery = s.object({
  page: s.number().int().min(1).default(1),
  pageSize: s.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = Infer<typeof PaginationQuery>;

export const PageMeta = s.object({
  page: s.number().int(),
  pageSize: s.number().int(),
  total: s.number().int(),
  totalPages: s.number().int(),
});
export type PageMeta = Infer<typeof PageMeta>;

export const pageMeta = (page: number, pageSize: number, total: number): PageMeta => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});
