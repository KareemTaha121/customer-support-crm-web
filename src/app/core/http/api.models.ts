/** One entry of `ApiResponse.errors` (Contracts/Common/ApiError.cs). */
export interface ApiErrorItem {
  code: string;
  message: string;
  field: string | null;
}

/** Contracts/Common/PaginationMeta.cs */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** The envelope every /api/v1 response uses (Contracts/Common/ApiResponse.cs). */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  message: string | null;
  errors: ApiErrorItem[];
  meta: PaginationMeta | null;
  correlationId: string | null;
}

/** A page of a list endpoint: `data` plus `meta` from the envelope. */
export interface Paged<T> {
  items: T[];
  meta: PaginationMeta;
}

export type SortDirection = 'asc' | 'desc';

/** Query parameters shared by every list endpoint; features add their own filters. */
export interface PageQuery {
  page?: number;
  pageSize?: number;
  search?: string | null;
  sortBy?: string | null;
  sortDirection?: SortDirection | null;
}

/** Values accepted as query parameters. `null`/`undefined`/'' are dropped. */
export type QueryValue = string | number | boolean | null | undefined | readonly (string | number | boolean)[];
export type QueryParams = Record<string, QueryValue>;

/** Contracts/Common/AttachmentResponse.cs */
export interface AttachmentResponse {
  id: string;
  fileName: string;
  contentType: string;
  size: number;
  isPublic: boolean;
  uploadedByName: string | null;
  createdAt: string;
  downloadUrl: string;
}

export const emptyPage = <T>(pageSize = 25): Paged<T> => ({
  items: [],
  meta: { page: 1, pageSize, totalCount: 0, totalPages: 0 },
});
