import { describe, expect, it, vi } from 'vitest';

async function loadInvoicePaymentLinkRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const ensureInvoiceOperationalArtifactsMock = vi.fn();
  const getVerifiedPaymentConnectionMock = vi.fn();
  const prismaMock = {
    invoice: {
      findFirst: vi.fn(),
    },
    paymentLink: {
      findMany: vi.fn(),
    },
  };

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/recovery-loop', () => ({
    ensureInvoiceOperationalArtifacts: ensureInvoiceOperationalArtifactsMock,
  }));
  vi.doMock('@/lib/provider-connections', async () => {
    const actual = await vi.importActual<typeof import('@/lib/provider-connections')>(
      '@/lib/provider-connections'
    );

    return {
      ...actual,
      getVerifiedPaymentConnection: getVerifiedPaymentConnectionMock,
    };
  });

  const route = await import('@/app/api/invoices/[id]/payment-link/route');
  return {
    route,
    authMock,
    prismaMock,
    ensureInvoiceOperationalArtifactsMock,
    getVerifiedPaymentConnectionMock,
  };
}

describe('/api/invoices/[id]/payment-link route handler', () => {
  it('rejects paid invoices', async () => {
    const { route, authMock, prismaMock, getVerifiedPaymentConnectionMock } =
      await loadInvoicePaymentLinkRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    getVerifiedPaymentConnectionMock.mockResolvedValue({
      record: { id: 'pay-1' },
    });
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'paid',
    });

    const response = await route.POST(
      new Request('http://localhost/api/invoices/inv-1/payment-link', { method: 'POST' }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'Cannot create a payment link for a paid invoice',
      code: 'CONFLICT',
    });
  });

  it('fails when no active payment link exists after regeneration', async () => {
    const {
      route,
      authMock,
      prismaMock,
      ensureInvoiceOperationalArtifactsMock,
      getVerifiedPaymentConnectionMock,
    } = await loadInvoicePaymentLinkRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    getVerifiedPaymentConnectionMock.mockResolvedValue({
      record: { id: 'pay-1' },
    });
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      status: 'pending',
    });
    ensureInvoiceOperationalArtifactsMock.mockResolvedValue(null);
    prismaMock.paymentLink.findMany.mockResolvedValue([]);

    const response = await route.POST(
      new Request('http://localhost/api/invoices/inv-1/payment-link', { method: 'POST' }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      error: 'No active payment link is available for this invoice',
      code: 'INTERNAL_ERROR',
    });
  });
});
