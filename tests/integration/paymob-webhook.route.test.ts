import { describe, expect, it, vi } from 'vitest';

async function loadPaymobWebhookRoute() {
  vi.resetModules();

  const prismaMock = {
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    paymentLink: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    reminderRun: {
      updateMany: vi.fn(),
    },
    invoiceEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock)
  );

  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/paymob', () => ({
    extractPaymobWebhookCore: vi.fn(() => ({
      amountCents: 12000,
      currency: 'EGP',
      isSuccess: true,
      providerEventId: 'paymob-event-1',
      signatureSource: {},
      receivedSignature: 'signed',
      invoiceReference: 'inv-1',
    })),
    verifyPaymobWebhookSignature: vi.fn(() => true),
  }));

  const route = await import('@/app/api/webhooks/paymob/route');
  return { route, prismaMock };
}

describe('/api/webhooks/paymob route handler', () => {
  it('marks invoices paid and suppresses future reminder runs for verified success callbacks', async () => {
    const { route, prismaMock } = await loadPaymobWebhookRoute();
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      userId: 'user-1',
      invoiceNo: 'INV-2026-001',
    });
    prismaMock.paymentEvent.findUnique.mockResolvedValue(null);

    const response = await route.POST(
      new Request('http://localhost/api/webhooks/paymob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obj: { id: 1 } }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ message: 'Paymob callback accepted' });
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceId: 'inv-1',
          provider: 'paymob',
          type: 'payment_succeeded',
        }),
      })
    );
    expect(prismaMock.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: {
        status: 'paid',
        paidAt: expect.any(Date),
      },
    });
    expect(prismaMock.reminderRun.updateMany).toHaveBeenCalled();
  });
});
