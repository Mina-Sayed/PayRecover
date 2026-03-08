import { describe, expect, it, vi } from 'vitest';

async function loadWatiWebhookRoute() {
  vi.resetModules();

  const prismaMock = {
    reminderRun: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    invoiceEvent: {
      create: vi.fn(),
    },
  };

  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/wati', () => ({
    verifyWatiWebhookSignature: vi.fn(() => true),
    mapWatiDeliveryStatus: vi.fn(() => ({
      providerMessageId: 'provider-msg-1',
      nextStatus: 'delivered',
    })),
  }));

  const route = await import('@/app/api/webhooks/wati/route');
  return { route, prismaMock };
}

describe('/api/webhooks/wati route handler', () => {
  it('updates reminder delivery status for verified callbacks', async () => {
    const { route, prismaMock } = await loadWatiWebhookRoute();
    prismaMock.reminderRun.findFirst.mockResolvedValue({
      id: 'run-1',
      invoiceId: 'inv-1',
      userId: 'user-1',
    });

    const response = await route.POST(
      new Request('http://localhost/api/webhooks/wati', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ localMessageId: 'provider-msg-1' }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ message: 'WATI callback accepted' });
    expect(prismaMock.reminderRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: {
        status: 'delivered',
        deliveryConfirmedAt: expect.any(Date),
        lastError: null,
      },
    });
    expect(prismaMock.invoiceEvent.create).toHaveBeenCalled();
  });
});
