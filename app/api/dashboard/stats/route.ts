import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { syncOpenInvoiceStatuses } from '@/lib/invoice-status';

/**
 * Provide dashboard statistics for the authenticated user.
 *
 * Returns a JSON response containing aggregated invoice and reminder metrics for the current user.
 * Also returns a 401 response when there is no authenticated user.
 *
 * @returns A Response whose JSON contains:
 * - `totalOutstanding` — total outstanding amount for invoices with status `overdue` or `pending` (number)
 * - `overdueCount` — count of invoices with status `overdue` or `pending` (number)
 * - `recoveredThisMonth` — total amount recovered from invoices marked `paid` since the start of the current month (number)
 * - `activeReminders` — count of active reminder templates for the user (number)
 * - `totalInvoices` — total invoice count for the user (number)
 * - `recentInvoices` — up to 5 invoices with status `overdue` or `pending`, including each invoice's `client` relation (array)
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return apiError('Unauthorized', 401, 'UNAUTHORIZED');
    }
    const userId = session.user.id;

    await syncOpenInvoiceStatuses(prisma, userId);

    const [totalOutstanding, recoveredThisMonth, activeReminders, totalInvoices, recentInvoices] =
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
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            },
          },
          _sum: { amount: true },
        }),
        prisma.reminderTemplate.count({
          where: { userId, active: true },
        }),
        prisma.invoice.count({ where: { userId } }),
        prisma.invoice.findMany({
          where: { userId, status: { in: ['overdue', 'pending'] } },
          include: { client: true },
          orderBy: { dueDate: 'asc' },
          take: 5,
        }),
      ]);

    return Response.json({
      totalOutstanding: totalOutstanding._sum.amount || 0,
      overdueCount: totalOutstanding._count._all,
      recoveredThisMonth: recoveredThisMonth._sum.amount || 0,
      activeReminders,
      totalInvoices,
      recentInvoices,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
