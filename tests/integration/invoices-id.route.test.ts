import { describe, expect, it, vi } from 'vitest';

async function loadInvoiceByIdRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    invoice: {
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    client: {
      update: vi.fn(),
    },
    invoiceEvent: {
      create: vi.fn(),
    },
    paymentEvent: {
      create: vi.fn(),
    },
    reminderRun: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock)
  );

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/recovery-loop', () => ({
    ensureInvoiceOperationalArtifacts: vi.fn(),
  }));

  const route = await import('@/app/api/invoices/[id]/route');
  return { route, authMock, prismaMock };
}

describe('/api/invoices/[id] route handlers', () => {
  it('updates invoice and client fields with scoped ownership checks', async () => {
    const { route, authMock, prismaMock } = await loadInvoiceByIdRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      userId: 'user-1',
      clientId: 'client-1',
      invoiceNo: 'INV-2026-001',
      amount: 300,
      currency: 'USD',
      status: 'pending',
      dueDate: new Date('2026-03-10T00:00:00.000Z'),
      notes: null,
      client: { id: 'client-1' },
      paymentLinks: [],
      events: [],
    });
    prismaMock.client.update.mockResolvedValue({ id: 'client-1' });
    prismaMock.invoice.update.mockResolvedValue({
      id: 'inv-1',
      invoiceNo: 'INV-2026-001',
      amount: 300,
      currency: 'USD',
      dueDate: new Date('2026-03-10T00:00:00.000Z'),
      status: 'paid',
      notes: null,
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      paymentLinks: [],
      events: [],
    });
    prismaMock.invoice.findFirst.mockResolvedValueOnce({
      id: 'inv-1',
      userId: 'user-1',
      clientId: 'client-1',
      invoiceNo: 'INV-2026-001',
      amount: 300,
      currency: 'USD',
      status: 'pending',
      dueDate: new Date('2026-03-10T00:00:00.000Z'),
      notes: null,
      client: { id: 'client-1' },
      paymentLinks: [],
      events: [],
    }).mockResolvedValueOnce({
      id: 'inv-1',
      invoiceNo: 'INV-2026-001',
      amount: 300,
      currency: 'USD',
      dueDate: new Date('2026-03-10T00:00:00.000Z'),
      status: 'paid',
      notes: null,
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      paymentLinks: [],
      events: [],
    });

    const response = await route.PATCH(
      new Request('http://localhost/api/invoices/inv-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'paid',
          clientName: 'Sara',
          phone: '+971500000000',
          email: 'sara@example.com',
        }),
      }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    );

    expect(response.status).toBe(200);
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1', userId: 'user-1' },
        include: expect.objectContaining({
          client: true,
          events: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        }),
      })
    );
    expect(prismaMock.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: expect.objectContaining({
        name: 'Sara',
        phone: '+971500000000',
        email: 'sara@example.com',
      }),
    });
    expect(prismaMock.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv-1' },
        data: expect.objectContaining({
          status: 'paid',
          paidAt: expect.any(Date),
        }),
      })
    );
    expect(prismaMock.invoiceEvent.create).toHaveBeenCalledTimes(2);
  });

  it('updates client fields without calling invoice.update when invoice fields are unchanged', async () => {
    const { route, authMock, prismaMock } = await loadInvoiceByIdRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce({
        id: 'inv-1',
        userId: 'user-1',
        clientId: 'client-1',
        invoiceNo: 'INV-2026-001',
        amount: 300,
        currency: 'USD',
        status: 'pending',
        dueDate: new Date('2026-03-10T00:00:00.000Z'),
        notes: null,
        client: { id: 'client-1', name: 'Old Name', phone: '+971500000000' },
        paymentLinks: [],
        events: [],
      })
      .mockResolvedValueOnce({
        id: 'inv-1',
        userId: 'user-1',
        clientId: 'client-1',
        invoiceNo: 'INV-2026-001',
        amount: 300,
        currency: 'USD',
        status: 'pending',
        dueDate: new Date('2026-03-10T00:00:00.000Z'),
        notes: null,
        client: { id: 'client-1', name: 'Sara', phone: '+971500000001' },
        paymentLinks: [],
        events: [],
      });
    prismaMock.client.update.mockResolvedValue({ id: 'client-1' });

    const response = await route.PATCH(
      new Request('http://localhost/api/invoices/inv-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Sara',
          phone: '+971500000001',
        }),
      }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      id: 'inv-1',
      client: { name: 'Sara', phone: '+971500000001' },
    });
    expect(prismaMock.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: {
        name: 'Sara',
        phone: '+971500000001',
      },
    });
    expect(prismaMock.invoice.update).not.toHaveBeenCalled();
    expect(prismaMock.invoiceEvent.create).toHaveBeenCalledWith({
      data: {
        invoiceId: 'inv-1',
        userId: 'user-1',
        type: 'invoice_client_updated',
        message: 'Client details updated: name, phone',
      },
    });
  });

  it('deletes invoice only when user owns the record', async () => {
    const { route, authMock, prismaMock } = await loadInvoiceByIdRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.findFirst.mockResolvedValue({ id: 'inv-1' });
    prismaMock.invoice.delete.mockResolvedValue({ id: 'inv-1' });

    const response = await route.DELETE(
      new Request('http://localhost/api/invoices/inv-1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: 'inv-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ message: 'Invoice deleted' });
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'inv-1', userId: 'user-1' },
      select: { id: true },
    });
  });
});
