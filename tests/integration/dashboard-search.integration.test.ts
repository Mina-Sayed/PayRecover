/* @vitest-environment jsdom */

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardSearch from '@/app/components/dashboard-search';

let mockPathname = '/dashboard';
let mockSearch = '';
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => ({
    get: (name: string) => new URLSearchParams(mockSearch).get(name),
    toString: () => new URLSearchParams(mockSearch).toString(),
  }),
  useRouter: () => ({
    push: pushMock,
  }),
}));

describe('dashboard search', () => {
  beforeEach(() => {
    mockPathname = '/dashboard';
    mockSearch = '';
    pushMock.mockReset();
  });

  it('navigates to invoices page when searching from dashboard overview', () => {
    render(React.createElement(DashboardSearch));

    const input = screen.getByPlaceholderText('Search clients or invoices...');
    const form = input.closest('form');

    fireEvent.change(input, { target: { value: 'sara' } });
    fireEvent.submit(form!);

    expect(pushMock).toHaveBeenCalledWith('/dashboard/invoices?search=sara');
  });

  it('updates current invoices URL query when searching within invoices page', () => {
    mockPathname = '/dashboard/invoices';
    mockSearch = 'status=paid&page=2';

    render(React.createElement(DashboardSearch));

    const input = screen.getByPlaceholderText('Search clients or invoices...');
    const form = input.closest('form');

    fireEvent.change(input, { target: { value: '  mina  ' } });
    fireEvent.submit(form!);

    expect(pushMock).toHaveBeenCalledWith('/dashboard/invoices?status=paid&search=mina');
  });
});
