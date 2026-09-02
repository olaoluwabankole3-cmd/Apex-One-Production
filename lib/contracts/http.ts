/**
 * APEX ONE — Canonical HTTP & Collection Contracts
 *
 * Stage 3 source of truth shared by backend routes, frontend clients, and
 * repository/service collection boundaries.
 *
 * Contract rules:
 * - Cursor pagination is the only public pagination model.
 * - Offset pagination is not part of the public contract.
 * - Collection metadata is explicit and structurally stable.
 * - Errors preserve machine-readable code, HTTP status, optional details,
 *   and request correlation metadata.
 */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

export interface CursorPaginationRequest {
  limit?: number;
  cursor?: string | null;
}

export interface PaginationMetadata {
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
  totalCount?: number;
}

/**
 * Storage/service collection result. This intentionally mirrors the public
 * pagination metadata so layers do not invent competing collection shapes.
 */
export interface PaginatedResult<T> extends PaginationMetadata {
  items: T[];
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  requestId?: string;
}

export interface ApiCollectionResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMetadata;
  requestId?: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  status: number;
  details?: unknown;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
export type ApiCollectionResult<T> = ApiCollectionResponse<T> | ApiErrorResponse;

export function toPaginationMetadata<T>(result: PaginatedResult<T>): PaginationMetadata {
  return {
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
    count: result.count,
    ...(result.totalCount !== undefined ? { totalCount: result.totalCount } : {}),
  };
}

export function toCollectionResponse<T>(
  result: PaginatedResult<T>,
  requestId?: string
): ApiCollectionResponse<T> {
  return {
    success: true,
    data: result.items,
    pagination: toPaginationMetadata(result),
    ...(requestId ? { requestId } : {}),
  };
}
