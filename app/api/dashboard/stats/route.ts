import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/api-response';
import { syncOpenInvoiceStatuses } from '@/lib/invoice-status';
import { decimalToNumber } from '@/lib/money';

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
      totalOutstanding: decimalToNumber(totalOutstanding._sum.amount || 0),
      overdueCount: totalOutstanding._count._all,
      recoveredThisMonth: decimalToNumber(recoveredThisMonth._sum.amount || 0),
      activeReminders,
      totalInvoices,
      recentInvoices: recentInvoices.map((invoice) => ({
        ...invoice,
        amount: decimalToNumber(invoice.amount),
      })),
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return apiError('Internal server error', 500, 'INTERNAL_ERROR');
  }
}
