import { describe, expect, it } from 'vitest';
import {
  clampInvoiceListPage,
  buildInvoiceSearchNavigation,
  buildInvoiceListQueryParams,
  getCreateInvoiceReloadPlan,
  getInvoiceListTotalPages,
  isLatestInvoiceListRequest,
  nextInvoiceListRequestVersion,
  readInvoiceSearchParam,
} from '@/lib/invoice-list-state';

describe('invoice list state helpers', () => {
  it('builds API query params for list requests', () => {
    const params = buildInvoiceListQueryParams({
      filter: 'overdue',
      searchQuery: 'sara',
      page: 3,
      limit: 10,
    });

    expect(params.toString()).toBe('status=overdue&search=sara&page=3&limit=10');
  });

  it('derives at least one total page for invoice listings', () => {
    expect(getInvoiceListTotalPages(0, 10)).toBe(1);
    expect(getInvoiceListTotalPages(11, 5)).toBe(3);
  });

  it('clamps invoice list pages into the available range', () => {
    expect(clampInvoiceListPage(3, 2)).toBe(2);
    expect(clampInvoiceListPage(0, 4)).toBe(1);
  });

  it('increments request version monotonically', () => {
    expect(nextInvoiceListRequestVersion(0)).toBe(1);
    expect(nextInvoiceListRequestVersion(41)).toBe(42);
  });

  it('detects whether a response belongs to the latest request', () => {
    expect(isLatestInvoiceListRequest(7, 7)).toBe(true);
    expect(isLatestInvoiceListRequest(6, 7)).toBe(false);
  });

  it('resets to page one and only reloads immediately when already on page one', () => {
    expect(getCreateInvoiceReloadPlan(1)).toEqual({ page: 1, loadImmediately: true });
    expect(getCreateInvoiceReloadPlan(4)).toEqual({ page: 1, loadImmediately: false });
  });

  it('reads normalized search query from URL params', () => {
    const params = new URLSearchParams('search=%20%20mina%20%20');
    expect(readInvoiceSearchParam(params)).toBe('mina');
  });

  it('builds dashboard invoice search navigation URL', () => {
    const params = new URLSearchParams('status=overdue&page=3');
    const target = buildInvoiceSearchNavigation('/dashboard/invoices', params, 'sara');

    expect(target).toBe('/dashboard/invoices?status=overdue&search=sara');
  });

  it('removes empty search and stale page from dashboard invoice URL', () => {
    const params = new URLSearchParams('status=paid&search=sara&page=2');
    const target = buildInvoiceSearchNavigation('/dashboard/invoices', params, '   ');

    expect(target).toBe('/dashboard/invoices?status=paid');
  });
});
