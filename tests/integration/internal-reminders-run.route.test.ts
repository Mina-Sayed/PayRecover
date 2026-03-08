import { describe, expect, it, vi } from 'vitest';

async function loadInternalReminderRunRoute() {
  vi.resetModules();

  const prismaMock = {};
  const dispatchMock = vi.fn();

  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/recovery-loop', () => ({
    dispatchDueReminderRuns: dispatchMock,
  }));

  const route = await import('@/app/api/internal/reminders/run/route');
  return { route, dispatchMock };
}

describe('/api/internal/reminders/run route handler', () => {
  it('rejects requests without the cron secret', async () => {
    const { route } = await loadInternalReminderRunRoute();

    const response = await route.POST(new Request('http://localhost/api/internal/reminders/run', {
      method: 'POST',
    }));

    expect(response.status).toBe(401);
  });

  it('dispatches due reminder runs when authorized', async () => {
    const { route, dispatchMock } = await loadInternalReminderRunRoute();
    dispatchMock.mockResolvedValue([{ id: 'run-1', status: 'sent' }]);

    const response = await route.POST(
      new Request('http://localhost/api/internal/reminders/run?limit=5', {
        method: 'POST',
        headers: {
          'x-cron-secret': process.env.CRON_SECRET!,
        },
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      processedCount: 1,
      processed: [{ id: 'run-1', status: 'sent' }],
    });
    expect(dispatchMock).toHaveBeenCalledWith(expect.anything(), expect.any(Date), 5);
  });
});
