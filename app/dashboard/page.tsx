'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
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
  dueReminderRuns: number;
  totalInvoices: number;
  remindersSentLast7Days: number;
  remindersDeliveredLast7Days: number;
  remindersFailedLast7Days: number;
  confirmedPaymentsThisMonth: number;
  recentInvoices: DashboardInvoice[];
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: string;
    invoice: {
      id: string;
      invoiceNo: string;
    } | null;
  }>;
}

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
    remindersSentLast7Days: data.remindersSentLast7Days,
    remindersDeliveredLast7Days: data.remindersDeliveredLast7Days,
    remindersFailedLast7Days: data.remindersFailedLast7Days,
    dueReminderRuns: data.dueReminderRuns,
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
            <h3 className="text-sm font-medium text-slate-500">Due Reminder Runs</h3>
            <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{data.dueReminderRuns}</span>
            <span className="text-xs font-medium text-blue-600 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              Due now
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Scheduled WhatsApp reminder runs awaiting dispatch</p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-slate-500">Confirmed Payments</h3>
            <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center text-purple-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{data.confirmedPaymentsThisMonth}</span>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              <ArrowUpRight className="w-3 h-3 mr-0.5" />
              This month
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">Validated payment confirmations and manual settlements</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Operational Snapshot</h3>
          <p className="text-sm text-slate-500">
            Built from reminder-run and payment-event records that already exist in the system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <div className="flex items-center gap-2 text-emerald-700 mb-3">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm font-medium">Delivery rate</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{snapshot.deliveryRate}%</div>
            <p className="text-xs text-slate-600 mt-2">
              Delivered reminder runs as a share of sent reminder runs in the last 7 days.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
            <div className="flex items-center gap-2 text-amber-700 mb-3">
              <Activity className="w-4 h-4" />
              <span className="text-sm font-medium">Failure rate</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{snapshot.failureRate}%</div>
            <p className="text-xs text-slate-600 mt-2">
              Failed reminder runs as a share of delivered plus failed runs in the last 7 days.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
            <div className="flex items-center gap-2 text-blue-700 mb-3">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Queue coverage</span>
            </div>
            <div className="text-3xl font-bold text-slate-900">{snapshot.queueCoverage}%</div>
            <p className="text-xs text-slate-600 mt-2">
              Due reminder runs relative to the number of invoices currently tracked.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-medium text-slate-900">Current operational note</p>
          <p className="text-sm text-slate-600 mt-1">
            The dashboard now reads from reminder-run and payment-event history where available. Deep trend
            analytics can layer on top later without changing invoice truth.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Recent Activity</h3>
          <p className="text-sm text-slate-500">Latest recovery actions across invoices, reminders, and payments.</p>
        </div>

        <div className="space-y-3">
          {data.recentActivity.length > 0 ? (
            data.recentActivity.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{event.message}</p>
                  <p className="text-xs text-slate-500">
                    {event.invoice?.invoiceNo ? `${event.invoice.invoiceNo} • ` : ''}
                    {new Date(event.createdAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  {event.type.replaceAll('_', ' ')}
                </p>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-sm text-slate-500">
              No invoice activity has been recorded yet.
            </div>
          )}
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
