'use client';

import React from 'react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { buildInvoiceSearchNavigation, readInvoiceSearchParam } from '@/lib/invoice-list-state';

const INVOICES_PATH = '/dashboard/invoices';

/**
 * Renders a dashboard search form for querying clients or invoices.
 *
 * The input is initialized from and kept in sync with the current URL search parameters.
 * Submitting the form navigates to the invoices route with the current query applied.
 *
 * @returns A JSX element containing the responsive search form and submit button.
 */
export default function DashboardSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSearch = useMemo(() => readInvoiceSearchParam(searchParams), [searchParams]);
  const [query, setQuery] = useState(currentSearch);

  useEffect(() => {
    setQuery(currentSearch);
  }, [currentSearch]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pathname === INVOICES_PATH) {
      router.push(buildInvoiceSearchNavigation(pathname, searchParams, query));
      return;
    }

    router.push(buildInvoiceSearchNavigation(INVOICES_PATH, new URLSearchParams(), query));
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full max-w-md hidden sm:block">
      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="text"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search clients or invoices..."
        className="w-full pl-9 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
      />
      <button
        type="submit"
        aria-label="Search invoices"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
      >
        Go
      </button>
    </form>
  );
}
