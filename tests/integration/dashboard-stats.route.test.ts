import { describe, expect, it, vi } from 'vitest';

async function loadDashboardStatsRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    invoice: {
      updateMany: vi.fn(),
      aggregate: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    reminderRun: {
      count: vi.fn(),
    },
    paymentEvent: {
      count: vi.fn(),
    },
    invoiceEvent: {
      findMany: vi.fn(),
    },
  };

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

  const route = await import('@/app/api/dashboard/stats/route');
  return { route, authMock, prismaMock };
}

describe('/api/dashboard/stats route handler', () => {
  it('enforces auth', async () => {
    const { route, authMock } = await loadDashboardStatsRoute();
    authMock.mockResolvedValue(null);

    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  });

  it('returns numeric overdue count from aggregate response', async () => {
    const { route, authMock, prismaMock } = await loadDashboardStatsRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1200 }, _count: { _all: 2 } })
      .mockResolvedValueOnce({ _sum: { amount: 400 } });
    prismaMock.reminderRun.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2);
    prismaMock.paymentEvent.count.mockResolvedValue(4);
    prismaMock.invoice.count.mockResolvedValue(9);
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoiceEvent.findMany.mockResolvedValue([]);

    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      totalOutstanding: 1200,
      overdueCount: 2,
      recoveredThisMonth: 400,
      dueReminderRuns: 3,
      totalInvoices: 9,
      remindersSentLast7Days: 8,
      remindersDeliveredLast7Days: 6,
      remindersFailedLast7Days: 2,
      confirmedPaymentsThisMonth: 4,
    });
    expect(typeof body.overdueCount).toBe('number');
    expect(prismaMock.invoice.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.invoice.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', status: { in: ['overdue', 'pending'] } },
        _count: { _all: true },
      })
    );
  });
});
