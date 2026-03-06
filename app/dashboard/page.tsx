'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  Activity,
} from 'lucide-react';
import { motion } from 'motion/react';
import Skeleton from '../components/skeleton';
import { apiFetch } from '@/lib/client-api';
import { calculateDashboardSnapshot } from '@/lib/dashboard-state';

interface DashboardInvoice {
  id: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'overdue' | 'paid';
  client: {
    id: string;
    name: string;
    phone: string;
  };
}

interface DashboardStatsResponse {
  totalOutstanding: number;
  overdueCount: number;
  recoveredThisMonth: number;
  activeReminders: number;
  totalInvoices: number;
  recentInvoices: DashboardInvoice[];
}

/**
 * Render skeleton placeholders for the dashboard overview while data is loading.
 *
 * Renders placeholder elements for the page header, four stat cards, a recovery snapshot panel,
 * and a recent invoices list to preserve layout and provide visual loading feedback.
 *
 * @returns A JSX element containing the dashboard skeleton layout
 */
function DashboardLoadingState() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-56 w-full" />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <Skeleton className="h-6 w-36" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

/**
 * Render the dashboard overview UI that loads and displays recovery statistics, a recovery snapshot, and recent outstanding invoices.
 *
 * Fetches dashboard statistics from the API, shows a loading skeleton while fetching, displays an error panel with retry on failure, and renders data-driven stat cards, snapshot panels, and a recent invoices list when available.
 *
 * @returns A React element rendering the dashboard overview based on fetched dashboard statistics.
 */
export default function DashboardOverview() {
  const [data, setData] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<DashboardStatsResponse>('/api/dashboard/stats');
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  if (loading) {
    return <DashboardLoadingState />;
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
          <p className="text-slate-500 text-sm mt-1">Track your payment recovery and active reminders.</p>
        </div>

        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center justify-between">
          <span>{error || 'Failed to load dashboard data'}</span>
          <button
            onClick={loadStats}
            className="px-3 py-1.5 bg-white border border-red-200 rounded-lg text-sm hover:bg-red-100 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const snapshot = calculateDashboardSnapshot({
    totalOutstanding: data.totalOutstanding,
    recoveredThisMonth: data.recoveredThisMonth,
    activeReminders: data.activeReminders,
    totalInvoices: data.totalInvoices,
  });

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Track your payment recovery and active reminders.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Outstanding</h3>
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-red-600">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">${data.totalOutstanding.toLocaleString()}</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Across {data.overdueCount} overdue/pending invoices</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Recovered This Month</h3>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">${data.recoveredThisMonth.toLocaleString()}</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              Updated
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Current month paid invoices</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Active Reminders</h3>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{data.activeReminders}</span>
            <span className="text-xs font-medium text-blue-600 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Across WhatsApp and SMS</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Total Invoices</h3>
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{data.totalInvoices}</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              <ArrowDownRight className="w-3 h-3 mr-0.5" />
              Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Tracked across your account</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Recovery Snapshot</h3>
          <p className="text-sm text-slate-500">
            Based on real aggregate totals. Historical event tracking is not live yet, so this panel
            shows truthful current-state ratios instead of a synthetic chart.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-emerald-700 mb-3">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Recovered share</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{snapshot.recoveredShare}%</div>
            <p className="text-xs text-slate-600 mt-2">
              Portion of tracked value recovered this month versus currently outstanding.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-amber-700 mb-3">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Outstanding share</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{snapshot.outstandingShare}%</div>
            <p className="text-xs text-slate-600 mt-2">
              Portion of tracked value still waiting to be collected.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-center gap-2 text-blue-700 mb-3">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Reminder coverage</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{snapshot.reminderCoverage}%</div>
            <p className="text-xs text-slate-600 mt-2">
              Active reminder steps relative to the number of invoices currently tracked.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">Current operational note</p>
          <p className="text-sm text-slate-600 mt-1">
            Trend charts should return after reminder-delivery and payment-event history is stored.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Recent Outstanding Invoices</h3>
          <p className="text-sm text-slate-500">The next invoices that need attention from your team.</p>
        </div>

        <div className="space-y-3">
          {data.recentInvoices.length > 0 ? (
            data.recentInvoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{invoice.client.name}</p>
                  <p className="text-xs text-slate-500">
                    {invoice.invoiceNo} • due{' '}
                    {new Date(invoice.dueDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    ${invoice.amount.toLocaleString()}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      invoice.status === 'overdue'
                        ? 'text-red-600'
                        : invoice.status === 'paid'
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {invoice.status}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No outstanding invoices need follow-up right now.
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
