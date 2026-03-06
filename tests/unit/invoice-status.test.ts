import { describe, expect, it, vi } from 'vitest';
import {
  getDerivedOpenInvoiceStatus,
  getEffectiveInvoiceStatus,
  getInvoiceStatusCutoff,
  syncOpenInvoiceStatuses,
} from '@/lib/invoice-status';

describe('invoice status helpers', () => {
  it('normalizes the status cutoff to the start of the day', () => {
    const cutoff = getInvoiceStatusCutoff(new Date('2026-03-06T14:25:00.000Z'));
    expect(cutoff.toISOString()).toBe('2026-03-06T00:00:00.000Z');
  });

  it('derives overdue or pending for unpaid invoices from due date', () => {
    const now = new Date('2026-03-06T14:25:00.000Z');

    expect(getDerivedOpenInvoiceStatus(new Date('2026-03-05T00:00:00.000Z'), now)).toBe('overdue');
    expect(getDerivedOpenInvoiceStatus(new Date('2026-03-06T00:00:00.000Z'), now)).toBe('pending');
  });

  it('keeps paid invoices paid regardless of due date', () => {
    const now = new Date('2026-03-06T14:25:00.000Z');

    expect(getEffectiveInvoiceStatus(new Date('2026-03-05T00:00:00.000Z'), 'paid', now)).toBe('paid');
  });

  it('syncs pending and overdue records around the daily cutoff', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });

    await syncOpenInvoiceStatuses(
      { invoice: { updateMany } },
      'user-1',
      new Date('2026-03-06T14:25:00.000Z')
    );

    expect(updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        userId: 'user-1',
        status: 'pending',
        dueDate: { lt: new Date('2026-03-06T00:00:00.000Z') },
      },
      data: { status: 'overdue' },
    });
    expect(updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        userId: 'user-1',
        status: 'overdue',
        dueDate: { gte: new Date('2026-03-06T00:00:00.000Z') },
      },
      data: { status: 'pending' },
    });
  });
});
