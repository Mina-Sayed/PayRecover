'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Fragment, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Search,
  MoreHorizontal,
  Download,
  Mail,
  MessageCircle,
  ChevronDown,
  MapPin,
  FileText,
  X,
  Check,
  Pencil,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useToast } from '../../components/toast';
import ConfirmDialog from '../../components/confirm-dialog';
import Skeleton from '../../components/skeleton';
import { apiFetch } from '@/lib/client-api';
import {
  buildInvoiceSearchNavigation,
  buildInvoiceListQueryParams,
  getCreateInvoiceReloadPlan,
  isLatestInvoiceListRequest,
  nextInvoiceListRequestVersion,
  readInvoiceSearchParam,
  type InvoiceStatusFilter,
} from '@/lib/invoice-list-state';

interface InvoiceClient {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
}

interface Invoice {
  id: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'overdue' | 'paid';
  notes: string | null;
  client: InvoiceClient;
  events: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }>;
}

interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  page: number;
  totalPages: number;
}

interface InvoiceFormState {
  clientName: string;
  phone: string;
  email: string;
  address: string;
  amount: string;
  dueDate: string;
}

const emptyForm: InvoiceFormState = {
  clientName: '',
  phone: '',
  email: '',
  address: '',
  amount: '',
  dueDate: '',
};

/**
 * Render skeleton placeholders used while the invoices list is loading.
 *
 * @returns A JSX element containing the loading skeleton UI for the invoices list.
 */
function InvoicesLoadingState() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-10 w-56" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Render the client-side invoices management UI including list display, searching, filtering, pagination, and create/edit/delete flows.
 *
 * The component manages loading state, API interactions (fetch, create, update, delete), toast notifications, modal dialogs for create/edit, expandable invoice rows with details, and URL synchronization for search. It also protects against out-of-order list responses using a request-versioning mechanism.
 *
 * @returns The invoices management UI as a React element.
 */
function InvoicesPageClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQueryFromUrl = useMemo(() => readInvoiceSearchParam(searchParams), [searchParams]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<InvoiceStatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState(searchQueryFromUrl);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [actionsOpenId, setActionsOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<InvoiceFormState>(emptyForm);
  const latestLoadRequestVersionRef = useRef(0);

  const { addToast } = useToast();

  const loadInvoices = useCallback(
    async (overrides?: Partial<{ filter: InvoiceStatusFilter; searchQuery: string; page: number }>) => {
      const requestVersion = nextInvoiceListRequestVersion(latestLoadRequestVersionRef.current);
      latestLoadRequestVersionRef.current = requestVersion;
      const activeFilter = overrides?.filter ?? filter;
      const activeSearchQuery = overrides?.searchQuery ?? searchQuery;
      const activePage = overrides?.page ?? page;

      setLoading(true);
      setError(null);
      try {
        const params = buildInvoiceListQueryParams({
          filter: activeFilter,
          searchQuery: activeSearchQuery,
          page: activePage,
          limit: 10,
        });
        const response = await apiFetch<InvoiceListResponse>(`/api/invoices?${params.toString()}`);
        if (!isLatestInvoiceListRequest(requestVersion, latestLoadRequestVersionRef.current)) {
          return;
        }
        setPage((currentPage) => (currentPage === response.page ? currentPage : response.page));
        setInvoices(response.invoices);
        setTotal(response.total);
        setTotalPages(response.totalPages || 1);
      } catch (err) {
        if (!isLatestInvoiceListRequest(requestVersion, latestLoadRequestVersionRef.current)) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Failed to load invoices');
      } finally {
        if (isLatestInvoiceListRequest(requestVersion, latestLoadRequestVersionRef.current)) {
          setLoading(false);
        }
      }
    },
    [filter, page, searchQuery]
  );

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    setSearchQuery((previous) => (previous === searchQueryFromUrl ? previous : searchQueryFromUrl));
    setPage(1);
  }, [searchQueryFromUrl]);

  const resetForm = useCallback(() => {
    setForm(emptyForm);
  }, []);

  const openCreateModal = () => {
    resetForm();
    setIsCreateModalOpen(true);
  };

  const openEditModal = (invoice: Invoice) => {
    setForm({
      clientName: invoice.client.name,
      phone: invoice.client.phone,
      email: invoice.client.email || '',
      address: invoice.client.address || '',
      amount: String(invoice.amount),
      dueDate: invoice.dueDate.slice(0, 10),
    });
    setEditingInvoice(invoice);
    setActionsOpenId(null);
  };

  const closeModals = () => {
    setIsCreateModalOpen(false);
    setEditingInvoice(null);
    resetForm();
  };

  const handleCreateInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiFetch<Invoice>('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          clientName: form.clientName,
          phone: form.phone,
          email: form.email,
          address: form.address,
          amount: Number(form.amount),
          dueDate: form.dueDate,
        }),
      });
      addToast('Invoice created successfully');
      closeModals();
      const reloadPlan = getCreateInvoiceReloadPlan(page);
      setPage(reloadPlan.page);
      if (reloadPlan.loadImmediately) {
        await loadInvoices({ page: reloadPlan.page });
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to create invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingInvoice) return;

    setSaving(true);
    try {
      await apiFetch<Invoice>(`/api/invoices/${editingInvoice.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          clientName: form.clientName,
          phone: form.phone,
          email: form.email,
          amount: Number(form.amount),
          dueDate: form.dueDate,
        }),
      });
      addToast(`Invoice ${editingInvoice.invoiceNo} updated successfully`);
      closeModals();
      await loadInvoices();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update invoice', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    try {
      const updated = await apiFetch<Invoice>(`/api/invoices/${invoice.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'paid' }),
      });
      addToast(`${invoice.client.name} marked as paid`);
      setActionsOpenId(null);
      setInvoices((prev) => prev.map((item) => (item.id === invoice.id ? updated : item)));
      await loadInvoices();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to update invoice', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      await apiFetch<{ message: string }>(`/api/invoices/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      addToast(`Invoice ${deleteTarget.invoiceNo} deleted`, 'error');
      setDeleteTarget(null);
      setActionsOpenId(null);
      await loadInvoices();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Failed to delete invoice', 'error');
    }
  };

  const handleFilterChange = (newFilter: InvoiceStatusFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setPage(1);
    const nextUrl = buildInvoiceSearchNavigation(pathname, searchParams, query);
    const currentQuery = searchParams.toString();
    const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, { scroll: false });
    }
  };

  const pageButtons = useMemo(() => {
    const pages = [] as number[];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);

  if (loading && invoices.length === 0) {
    return <InvoicesLoadingState />;
  }

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients & Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your subscriptions, clients, and payment statuses.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-emerald-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-600 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Invoice
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => {
              void loadInvoices();
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 rounded-lg text-sm hover:bg-red-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search clients, IDs, emails..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 w-full sm:w-72"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-200">
            {(['all', 'overdue', 'pending', 'paid'] as const).map((status) => (
              <button
                key={status}
                onClick={() => handleFilterChange(status)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                  filter === status
                    ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 bg-slate-50 uppercase border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Client Details</th>
                <th className="px-6 py-4 font-medium">Invoice ID</th>
                <th className="px-6 py-4 font-medium">Amount</th>
                <th className="px-6 py-4 font-medium">Due Date</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={`loading-${i}`}>
                    <td colSpan={6} className="px-6 py-3">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ))}

              {!loading &&
                invoices.map((invoice) => (
                  <Fragment key={invoice.id}>
                    <tr
                      className={`hover:bg-slate-50/50 transition-colors group ${
                        expandedRowId === invoice.id ? 'bg-slate-50/50' : ''
                      }`}
                    >
                      <td
                        className="px-6 py-4 cursor-pointer"
                        onClick={() => setExpandedRowId((prev) => (prev === invoice.id ? null : invoice.id))}
                      >
                        <div className="font-medium text-slate-900 flex items-center gap-2">
                          {invoice.client.name}
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                              expandedRowId === invoice.id ? 'rotate-180' : ''
                            }`}
                          />
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-emerald-500" />
                          {invoice.client.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono text-xs">{invoice.invoiceNo}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">${invoice.amount.toLocaleString()}</td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        {invoice.status === 'overdue' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700 border border-red-100">
                            Overdue
                          </span>
                        )}
                        {invoice.status === 'pending' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700 border border-yellow-100">
                            Pending
                          </span>
                        )}
                        {invoice.status === 'paid' && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Paid
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() =>
                              setActionsOpenId(actionsOpenId === invoice.id ? null : invoice.id)
                            }
                            aria-label={`Open actions for ${invoice.invoiceNo}`}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          <AnimatePresence>
                            {actionsOpenId === invoice.id && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -6 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95, y: -6 }}
                                transition={{ duration: 0.14 }}
                                className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1"
                              >
                                {invoice.status !== 'paid' && (
                                  <button
                                    onClick={() => handleMarkAsPaid(invoice)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                  >
                                    <Check className="w-4 h-4" />
                                    Mark as Paid
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditModal(invoice)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Pencil className="w-4 h-4" />
                                  Edit Invoice
                                </button>
                                <button
                                  type="button"
                                  disabled
                                  aria-disabled
                                  title="Coming soon"
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-400 bg-slate-50 cursor-not-allowed"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                  WhatsApp Delivery (Coming soon)
                                </button>
                                <button
                                  onClick={() => {
                                    addToast('PDF generation will be enabled in next phase', 'info');
                                    setActionsOpenId(null);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                                >
                                  <Download className="w-4 h-4" />
                                  Download PDF
                                </button>
                                <div className="border-t border-slate-100 my-1" />
                                <button
                                  onClick={() => {
                                    setDeleteTarget(invoice);
                                    setActionsOpenId(null);
                                  }}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                  Delete Invoice
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </td>
                    </tr>

                    <AnimatePresence>
                      {expandedRowId === invoice.id && (
                        <tr className="bg-slate-50/30 border-b border-slate-200">
                          <td colSpan={6} className="px-6 py-6">
                            <motion.div
                              initial={{ opacity: 0, y: -8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.2 }}
                              className="grid grid-cols-1 md:grid-cols-3 gap-8"
                            >
                              <div>
                                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">
                                  Contact Information
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <Mail className="w-4 h-4 text-slate-400" />
                                    {invoice.client.email || 'No email'}
                                  </div>
                                  <div className="flex items-center gap-3 text-sm text-slate-600">
                                    <MapPin className="w-4 h-4 text-slate-400" />
                                    {invoice.client.address || 'No address'}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">
                                  Invoice Notes
                                </h4>
                                <div className="p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 min-h-[76px]">
                                  {invoice.notes || 'No notes added for this invoice.'}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider mb-4">
                                  Recent Activity
                                </h4>
                                {invoice.events.length > 0 ? (
                                  <div className="space-y-3">
                                    {invoice.events.map((event) => (
                                      <div
                                        key={event.id}
                                        className="rounded-xl border border-slate-200 bg-white p-3"
                                      >
                                        <p className="text-sm font-medium text-slate-900">
                                          {event.message}
                                        </p>
                                        <p className="text-xs text-slate-500 mt-1">
                                          {new Date(event.createdAt).toLocaleString('en-US', {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                            hour: 'numeric',
                                            minute: '2-digit',
                                          })}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                                    No invoice activity has been recorded yet.
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                ))}

              {!loading && invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                        <FileText className="w-6 h-6 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">No invoices found</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {searchQuery
                            ? 'Try adjusting your search query.'
                            : 'No invoices match the current filter.'}
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-500">
          <div>
            Showing {invoices.length} of {total} invoices
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {pageButtons.map((pageNumber) => (
              <button
                key={pageNumber}
                onClick={() => setPage(pageNumber)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                  page === pageNumber
                    ? 'bg-emerald-500 text-white'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                {pageNumber}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Create New Invoice</h2>
                <button
                  onClick={closeModals}
                  aria-label="Close create invoice modal"
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateInvoice} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                  <input
                    required
                    name="clientName"
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
                    placeholder="e.g. Sarah Fitness"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
                    <input
                      required
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="+971 50..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      required
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="client@email.com"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                  <input
                    name="address"
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="City, Country"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                    <input
                      required
                      name="amount"
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                    <input
                      required
                      name="dueDate"
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-60"
                  >
                    {saving ? 'Creating...' : 'Create & Send'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-slate-100">
                <h2 className="text-lg font-bold text-slate-900">Edit Invoice — {editingInvoice.invoiceNo}</h2>
                <button
                  onClick={closeModals}
                  aria-label="Close edit invoice modal"
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleEditInvoice} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Client Name</label>
                  <input
                    required
                    name="clientName"
                    type="text"
                    value={form.clientName}
                    onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp Number</label>
                    <input
                      required
                      name="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input
                      required
                      name="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount ($)</label>
                    <input
                      required
                      name="amount"
                      type="number"
                      min="1"
                      value={form.amount}
                      onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
                    <input
                      required
                      name="dueDate"
                      type="date"
                      value={form.dueDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={closeModals}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Invoice"
        message={`Are you sure you want to delete ${deleteTarget?.invoiceNo}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </motion.div>
  );
}

/**
 * Wraps the invoices client component in a React Suspense boundary that shows a loading state while the client component is suspended.
 *
 * @returns The page element rendering `InvoicesPageClient` inside `Suspense` with `InvoicesLoadingState` as the fallback.
 */
export default function InvoicesPage() {
  return (
    <Suspense fallback={<InvoicesLoadingState />}>
      <InvoicesPageClient />
    </Suspense>
  );
}
