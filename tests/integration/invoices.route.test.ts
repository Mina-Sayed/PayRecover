import { describe, expect, it, vi } from 'vitest';

async function loadInvoicesRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    client: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invoice: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    invoiceEvent: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) =>
    callback(prismaMock)
  );

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

  const route = await import('@/app/api/invoices/route');
  return { route, authMock, prismaMock };
}

describe('/api/invoices route handlers', () => {
  it('enforces auth for list endpoint', async () => {
    const { route, authMock } = await loadInvoicesRoute();
    authMock.mockResolvedValue(null);

    const response = await route.GET(new Request('http://localhost/api/invoices'));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  });

  it('applies user scoping with search and pagination on list endpoint', async () => {
    const { route, authMock, prismaMock } = await loadInvoicesRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        invoiceNo: 'INV-2026-001',
        amount: 120,
        dueDate: new Date('2026-01-15').toISOString(),
        status: 'overdue',
        client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      },
    ]);
    prismaMock.invoice.count.mockResolvedValue(11);

    const response = await route.GET(
      new Request('http://localhost/api/invoices?status=overdue&search=sara&page=2&limit=5')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ total: 11, page: 2, totalPages: 3 });
    expect(prismaMock.invoice.updateMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.invoice.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: 'overdue',
        OR: [
          { client: { is: { name: { contains: 'sara', mode: 'insensitive' } } } },
          { invoiceNo: { contains: 'sara', mode: 'insensitive' } },
          { client: { is: { email: { contains: 'sara', mode: 'insensitive' } } } },
        ],
      },
    });
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          status: 'overdue',
          OR: [
            { client: { is: { name: { contains: 'sara', mode: 'insensitive' } } } },
            { invoiceNo: { contains: 'sara', mode: 'insensitive' } },
            { client: { is: { email: { contains: 'sara', mode: 'insensitive' } } } },
          ],
        },
        skip: 5,
        take: 5,
      })
    );
  });

  it('clamps out-of-range list pages to the last available page', async () => {
    const { route, authMock, prismaMock } = await loadInvoicesRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.count.mockResolvedValue(6);
    prismaMock.invoice.findMany.mockResolvedValue([
      {
        id: 'inv-6',
        invoiceNo: 'INV-2026-006',
        amount: 120,
        dueDate: new Date('2026-01-15').toISOString(),
        status: 'pending',
        client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      },
    ]);

    const response = await route.GET(new Request('http://localhost/api/invoices?page=3&limit=5'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ total: 6, page: 2, totalPages: 2 });
    expect(prismaMock.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5,
        take: 5,
      })
    );
  });

  it('creates invoices with deterministic sequence and user ownership', async () => {
    const { route, authMock, prismaMock } = await loadInvoicesRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.client.findFirst.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      name: 'Sara',
      phone: '+971500000000',
      email: 'sara@example.com',
      address: 'Dubai',
    });
    prismaMock.invoice.findMany.mockResolvedValue([
      { invoiceNo: 'INV-2026-001' },
      { invoiceNo: 'INV-2026-003' },
    ]);
    prismaMock.invoice.create.mockResolvedValue({
      id: 'inv-2',
      invoiceNo: 'INV-2026-004',
      userId: 'user-1',
      clientId: 'client-1',
      amount: 300,
      status: 'pending',
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      events: [],
    });
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-2',
      invoiceNo: 'INV-2026-004',
      userId: 'user-1',
      clientId: 'client-1',
      amount: 300,
      status: 'pending',
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      events: [
        {
          id: 'evt-1',
          type: 'invoice_created',
          message: 'Invoice INV-2026-004 created for Sara',
          createdAt: new Date('2026-03-01T10:00:00.000Z').toISOString(),
        },
      ],
    });

    const response = await route.POST(
      new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Sara',
          phone: '+971500000000',
          email: 'sara@example.com',
          address: 'Dubai',
          amount: 300,
          dueDate: '2026-03-10',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ invoiceNo: 'INV-2026-004' });
    expect(prismaMock.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          clientId: 'client-1',
          invoiceNo: 'INV-2026-004',
        }),
      })
    );
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(prismaMock.invoiceEvent.create).toHaveBeenCalledWith({
      data: {
        invoiceId: 'inv-2',
        userId: 'user-1',
        type: 'invoice_created',
        message: 'Invoice INV-2026-004 created for Sara',
      },
    });
  });

  it('retries invoice creation after invoice number unique conflicts', async () => {
    const { route, authMock, prismaMock } = await loadInvoicesRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.client.findFirst.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      name: 'Sara',
      phone: '+971500000000',
      email: 'sara@example.com',
      address: 'Dubai',
    });

    prismaMock.$transaction
      .mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['userId', 'invoiceNo'] },
      })
      .mockImplementation(async (callback: (tx: typeof prismaMock) => unknown) => callback(prismaMock));

    prismaMock.invoice.findMany.mockResolvedValue([{ invoiceNo: 'INV-2026-001' }]);
    prismaMock.invoice.create.mockResolvedValue({
      id: 'inv-2',
      invoiceNo: 'INV-2026-002',
      userId: 'user-1',
      clientId: 'client-1',
      amount: 300,
      status: 'pending',
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      events: [],
    });
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-2',
      invoiceNo: 'INV-2026-002',
      userId: 'user-1',
      clientId: 'client-1',
      amount: 300,
      status: 'pending',
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      events: [],
    });

    const response = await route.POST(
      new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Sara',
          phone: '+971500000000',
          email: 'sara@example.com',
          address: 'Dubai',
          amount: 300,
          dueDate: '2026-03-10',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ invoiceNo: 'INV-2026-002' });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
  });

  it('creates past-due invoices as overdue immediately', async () => {
    const { route, authMock, prismaMock } = await loadInvoicesRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.client.findFirst.mockResolvedValue(null);
    prismaMock.client.create.mockResolvedValue({
      id: 'client-1',
      userId: 'user-1',
      name: 'Sara',
      phone: '+971500000000',
      email: 'sara@example.com',
      address: 'Dubai',
    });
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.invoice.create.mockResolvedValue({
      id: 'inv-3',
      invoiceNo: 'INV-2026-001',
      userId: 'user-1',
      clientId: 'client-1',
      amount: 300,
      status: 'overdue',
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      events: [],
    });
    prismaMock.invoice.findFirst.mockResolvedValue({
      id: 'inv-3',
      invoiceNo: 'INV-2026-001',
      userId: 'user-1',
      clientId: 'client-1',
      amount: 300,
      status: 'overdue',
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      events: [],
    });

    const response = await route.POST(
      new Request('http://localhost/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: 'Sara',
          phone: '+971500000000',
          email: 'sara@example.com',
          address: 'Dubai',
          amount: 300,
          dueDate: '2020-03-10',
        }),
      })
    );

    expect(response.status).toBe(201);
    expect(prismaMock.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'overdue',
        }),
      })
    );
  });

  it('updates invoice status in scoped bulk patch endpoint', async () => {
    const { route, authMock, prismaMock } = await loadInvoicesRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.findFirst
      .mockResolvedValueOnce({
        id: 'inv-1',
        status: 'pending',
        dueDate: new Date('2026-03-10T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'inv-1',
        invoiceNo: 'INV-2026-004',
        status: 'paid',
        client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
        events: [],
      });
    prismaMock.invoice.update.mockResolvedValue({
      id: 'inv-1',
      invoiceNo: 'INV-2026-004',
      status: 'paid',
      client: { id: 'client-1', name: 'Sara', phone: '+971500000000' },
      events: [],
    });

    const response = await route.PATCH(
      new Request('http://localhost/api/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'inv-1', status: 'paid' }),
      })
    );

    expect(response.status).toBe(200);
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith({
      where: { id: 'inv-1', userId: 'user-1' },
      select: { id: true, status: true, dueDate: true },
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
    expect(prismaMock.invoiceEvent.create).toHaveBeenCalledWith({
      data: {
        invoiceId: 'inv-1',
        userId: 'user-1',
        type: 'invoice_marked_paid',
        message: 'Invoice INV-2026-004 marked as paid',
      },
    });
  });
});
