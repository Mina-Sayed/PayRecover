import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { serializeDashboardRecentInvoice } from '@/lib/dashboard-serialization';

describe('dashboard serialization helpers', () => {
  it('serializes recent invoices into dashboard-safe JSON', () => {
    const serialized = serializeDashboardRecentInvoice({
      id: 'inv-1',
      invoiceNo: 'INV-001',
      amount: new Prisma.Decimal('125.50'),
      dueDate: new Date('2026-03-10T00:00:00.000Z'),
      status: 'overdue',
      clientId: 'client-1',
      userId: 'user-1',
      currency: 'USD',
      notes: null,
      paidAt: null,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-02T00:00:00.000Z'),
      client: {
        id: 'client-1',
        name: 'Acme Corp',
        phone: '+15551234567',
      },
    });

    expect(serialized).toEqual({
      id: 'inv-1',
      invoiceNo: 'INV-001',
      amount: 125.5,
      dueDate: '2026-03-10T00:00:00.000Z',
      status: 'overdue',
      client: {
        id: 'client-1',
        name: 'Acme Corp',
        phone: '+15551234567',
      },
    });
  });
});
