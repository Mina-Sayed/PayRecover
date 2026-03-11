import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { isDatabaseConnectivityError } from '@/lib/database-errors';
import { requireEnv } from '@/lib/env';
import { syncOpenInvoiceStatuses } from '@/lib/invoice-status';
import {
  dashboardRecentInvoiceInclude,
  serializeDashboardRecentInvoice,
} from '@/lib/dashboard-serialization';
import { decimalToNumber } from '@/lib/money';
import { callSupabaseRpc } from '@/lib/supabase-rpc';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    try {
      await syncOpenInvoiceStatuses(prisma, userId);

      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const [
        totalOutstanding,
        recoveredThisMonth,
        dueReminderRuns,
        totalInvoices,
        recentInvoices,
        remindersSentLast7Days,
        remindersDeliveredLast7Days,
        remindersFailedLast7Days,
        confirmedPaymentsThisMonth,
        recentActivity,
      ] =
        await Promise.all([
          prisma.invoice.aggregate({
            where: { userId, status: { in: ['overdue', 'pending'] } },
            _sum: { amount: true },
            _count: { _all: true },
          }),
          prisma.invoice.aggregate({
            where: {
              userId,
              status: 'paid',
              paidAt: {
                gte: monthStart,
              },
            },
            _sum: { amount: true },
          }),
          prisma.reminderRun.count({
            where: {
              userId,
              status: 'scheduled',
              scheduledFor: {
                lte: now,
              },
              invoice: {
                status: { not: 'paid' },
              },
            },
          }),
          prisma.invoice.count({ where: { userId } }),
          prisma.invoice.findMany({
            where: { userId, status: { in: ['overdue', 'pending'] } },
            include: dashboardRecentInvoiceInclude,
            orderBy: { dueDate: 'asc' },
            take: 5,
          }),
          prisma.reminderRun.count({
            where: {
              userId,
              sentAt: {
                gte: sevenDaysAgo,
              },
            },
          }),
          prisma.reminderRun.count({
            where: {
              userId,
              status: 'delivered',
              deliveryConfirmedAt: {
                gte: sevenDaysAgo,
              },
            },
          }),
          prisma.reminderRun.count({
            where: {
              userId,
              status: 'failed',
              updatedAt: {
                gte: sevenDaysAgo,
              },
            },
          }),
          prisma.paymentEvent.count({
            where: {
              userId,
              type: { in: ['payment_succeeded', 'manual_mark_paid'] },
              createdAt: {
                gte: monthStart,
              },
            },
          }),
          prisma.invoiceEvent.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 6,
            include: {
              invoice: {
                select: {
                  id: true,
                  invoiceNo: true,
                },
              },
            },
          }),
        ]);

      return Response.json({
        totalOutstanding: decimalToNumber(totalOutstanding._sum.amount || 0),
        overdueCount: totalOutstanding._count._all,
        recoveredThisMonth: decimalToNumber(recoveredThisMonth._sum.amount || 0),
        dueReminderRuns,
        totalInvoices,
        remindersSentLast7Days,
        remindersDeliveredLast7Days,
        remindersFailedLast7Days,
        confirmedPaymentsThisMonth,
        recentInvoices: recentInvoices.map(serializeDashboardRecentInvoice),
        recentActivity: recentActivity.map((event) => ({
          id: event.id,
          type: event.type,
          message: event.message,
          createdAt: event.createdAt.toISOString(),
          invoice: event.invoice,
        })),
      });
    } catch (error) {
      if (isDatabaseConnectivityError(error)) {
        const payload = await callSupabaseRpc<Record<string, unknown>>('app_get_dashboard_stats', {
          p_user_id: userId,
          p_secret: requireEnv('PROVIDER_CONFIG_SECRET'),
        });

        return Response.json(payload);
      }

      throw error;
    }
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
