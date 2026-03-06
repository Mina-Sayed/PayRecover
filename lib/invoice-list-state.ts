export type InvoiceStatusFilter = 'all' | 'overdue' | 'pending' | 'paid';

export interface InvoiceListQuery {
  filter: InvoiceStatusFilter;
  searchQuery: string;
  page: number;
  limit: number;
}

export interface CreateInvoiceReloadPlan {
  page: number;
  loadImmediately: boolean;
}

interface SearchParamSource {
  get(name: string): string | null;
  toString(): string;
}

/**
 * Create URLSearchParams representing an invoice list query.
 *
 * @param query - Object containing `filter`, `searchQuery`, `page`, and `limit` for the invoice list
 * @returns URLSearchParams with keys `status` (from `filter`), `search` (from `searchQuery`), `page`, and `limit`
 */
export function buildInvoiceListQueryParams(query: InvoiceListQuery): URLSearchParams {
  return new URLSearchParams({
    status: query.filter,
    search: query.searchQuery,
    page: String(query.page),
    limit: String(query.limit),
  });
}

/**
 * Compute the number of pages required to display a collection of items given a page size.
 *
 * @param total - The total number of items
 * @param limit - The maximum number of items per page
 * @returns The total number of pages required, at least 1
 */
export function getInvoiceListTotalPages(total: number, limit: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 1;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / limit));
}

/**
 * Clamp a requested invoice list page to the valid page range.
 *
 * @param page - Requested page; non-integer values are floored. Values that are not finite or less than or equal to 0 are treated as 1.
 * @param totalPages - Total available pages; non-integer values are floored. Values that are not finite or less than or equal to 0 are treated as 1.
 * @returns The page number constrained to be at least 1 and at most `totalPages`.
 */
export function clampInvoiceListPage(page: number, totalPages: number): number {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 1;

  return Math.min(safePage, safeTotalPages);
}

/**
 * Advance the invoice list request version by one.
 *
 * @param currentVersion - The current request version number
 * @returns The next request version, one greater than `currentVersion`
 */
export function nextInvoiceListRequestVersion(currentVersion: number): number {
  return currentVersion + 1;
}

/**
 * Determine whether a request version matches the latest invoice list request version.
 *
 * @param requestVersion - The version number of the request to verify
 * @param latestVersion - The current latest request version
 * @returns `true` if `requestVersion` equals `latestVersion`, `false` otherwise
 */
export function isLatestInvoiceListRequest(requestVersion: number, latestVersion: number): boolean {
  return requestVersion === latestVersion;
}

/**
 * Create a reload plan that resets the invoice list to the first page and indicates if it should load immediately.
 *
 * @param currentPage - The currently displayed page number
 * @returns An object with `page` set to 1 and `loadImmediately` set to `true` when `currentPage` is 1, `false` otherwise
 */
export function getCreateInvoiceReloadPlan(currentPage: number): CreateInvoiceReloadPlan {
  return {
    page: 1,
    loadImmediately: currentPage === 1,
  };
}

/**
 * Read and normalize the 'search' query parameter from a search-params source.
 *
 * @param searchParams - Object with a `get(name)` method used to read query parameters
 * @returns The trimmed value of the `search` parameter if present, otherwise an empty string
 */
export function readInvoiceSearchParam(searchParams: Pick<SearchParamSource, 'get'>): string {
  const raw = searchParams.get('search');
  return raw ? raw.trim() : '';
}

/**
 * Build a navigation URL for the invoice list by applying a normalized search query and clearing pagination.
 *
 * Updates the provided query parameters by setting the `search` parameter to the trimmed `searchQuery` (or removing it if empty) and removing the `page` parameter, then returns the pathname combined with the resulting query string when non-empty.
 *
 * @param pathname - Base path to navigate to (e.g., `/invoices`)
 * @param searchParams - An object exposing `toString()` that yields the current query string
 * @param searchQuery - Search text to apply; whitespace is trimmed before use
 * @returns The pathname with an updated query string if parameters remain, otherwise the pathname alone
 */
export function buildInvoiceSearchNavigation(
  pathname: string,
  searchParams: Pick<SearchParamSource, 'toString'>,
  searchQuery: string
): string {
  const nextParams = new URLSearchParams(searchParams.toString());
  const normalized = searchQuery.trim();

  if (normalized) {
    nextParams.set('search', normalized);
  } else {
    nextParams.delete('search');
  }

  nextParams.delete('page');

  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
