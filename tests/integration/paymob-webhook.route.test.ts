import { describe, expect, it, vi } from 'vitest';
import { encryptProviderConfig } from '@/lib/provider-connections';

async function loadPaymobWebhookRoute() {
  vi.resetModules();

  const prismaMock = {
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    paymentLink: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    paymentProviderConnection: {
      findFirst: vi.fn(),
    },
    paymentEvent: {
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
      amount: 120,
      currency: 'EGP',
    });
    prismaMock.paymentProviderConnection.findFirst.mockResolvedValue({
      id: 'pay-1',
      encryptedConfig: encryptProviderConfig({
        publicKey: 'pk_test_123',
        secretKey: 'sk_test_123',
        integrationId: '123456',
        hmacSecret: 'hmac',
        apiBaseUrl: 'https://accept.paymob.com',
      }),
    });

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
          providerConnectionId: 'pay-1',
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

  it('rejects malformed JSON before touching the database', async () => {
    const { route, prismaMock } = await loadPaymobWebhookRoute();

    const response = await route.POST(
      new Request('http://localhost/api/webhooks/paymob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({ error: 'Invalid Paymob payload', code: 'VALIDATION_ERROR' });
    expect(prismaMock.invoice.findFirst).not.toHaveBeenCalled();
  });

  it('rejects successful callbacks that do not match the invoice amount or currency', async () => {
    const { route, prismaMock } = await loadPaymobWebhookRoute();
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      userId: 'user-1',
      invoiceNo: 'INV-2026-001',
      amount: 99,
      currency: 'USD',
    });
    prismaMock.paymentProviderConnection.findFirst.mockResolvedValue({
      id: 'pay-1',
      encryptedConfig: encryptProviderConfig({
        publicKey: 'pk_test_123',
        secretKey: 'sk_test_123',
        integrationId: '123456',
        hmacSecret: 'hmac',
        apiBaseUrl: 'https://accept.paymob.com',
      }),
    });

    const response = await route.POST(
      new Request('http://localhost/api/webhooks/paymob', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obj: { id: 1 } }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'Paymob payment does not match invoice amount or currency',
      code: 'CONFLICT',
    });
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
    expect(prismaMock.paymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'callback_rejected',
        }),
      })
    );
  });
});
