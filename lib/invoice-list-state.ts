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

export function buildInvoiceListQueryParams(query: InvoiceListQuery): URLSearchParams {
  return new URLSearchParams({
    status: query.filter,
    search: query.searchQuery,
    page: String(query.page),
    limit: String(query.limit),
  });
}

export function getInvoiceListTotalPages(total: number, limit: number): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 1;
  }

  if (!Number.isFinite(limit) || limit <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(total / limit));
}

export function clampInvoiceListPage(page: number, totalPages: number): number {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safeTotalPages = Number.isFinite(totalPages) && totalPages > 0 ? Math.floor(totalPages) : 1;

  return Math.min(safePage, safeTotalPages);
}

export function nextInvoiceListRequestVersion(currentVersion: number): number {
  return currentVersion + 1;
}

export function isLatestInvoiceListRequest(requestVersion: number, latestVersion: number): boolean {
  return requestVersion === latestVersion;
}

export function getCreateInvoiceReloadPlan(currentPage: number): CreateInvoiceReloadPlan {
  return {
    page: 1,
    loadImmediately: currentPage === 1,
  };
}

export function readInvoiceSearchParam(searchParams: Pick<SearchParamSource, 'get'>): string {
  const raw = searchParams.get('search');
  return raw ? raw.trim() : '';
}

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
