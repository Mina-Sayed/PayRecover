import { describe, expect, it } from 'vitest';
import {
  applyInvoiceStatusUpdate,
  calculateDashboardSnapshot,
  updateReminderDraft,
  withReminderOrder,
  type ReminderDraft,
  type InvoiceDraft,
} from '@/lib/dashboard-state';

describe('dashboard state helpers', () => {
  it('updates a single invoice status without mutating others', () => {
    const invoices: InvoiceDraft[] = [
      { id: 'inv-1', status: 'pending', amount: 100 },
      { id: 'inv-2', status: 'overdue', amount: 200 },
    ];

    const updated = applyInvoiceStatusUpdate(invoices, 'inv-2', 'paid');
    expect(updated).toEqual([
      { id: 'inv-1', status: 'pending', amount: 100 },
      { id: 'inv-2', status: 'paid', amount: 200 },
    ]);
  });

  it('updates reminder draft fields for matching reminder id', () => {
    const reminders: ReminderDraft[] = [
      {
        id: 'rem-1',
        channel: 'whatsapp',
        timing: '1 Day Before Due',
        template: 'Initial',
        providerTemplateName: null,
        active: true,
        order: 0,
      },
    ];

    const updated = updateReminderDraft(reminders, 'rem-1', {
      timing: 'On Due Date',
      active: false,
    });

    expect(updated[0]).toMatchObject({
      id: 'rem-1',
      timing: 'On Due Date',
      active: false,
    });
  });

  it('reassigns order index by array position', () => {
    const reminders: ReminderDraft[] = [
      {
        id: 'rem-2',
        channel: 'sms',
        timing: '7 Days Overdue',
        template: 'B',
        providerTemplateName: null,
        active: true,
        order: 4,
      },
      {
        id: 'rem-1',
        channel: 'sms',
        timing: '1 Day Overdue',
        template: 'A',
        providerTemplateName: null,
        active: true,
        order: 8,
      },
    ];

    const ordered = withReminderOrder(reminders);
    expect(ordered.map((item) => item.order)).toEqual([0, 1]);
  });

  it('calculates dashboard snapshot ratios from real totals', () => {
    const snapshot = calculateDashboardSnapshot({
      totalOutstanding: 300,
      recoveredThisMonth: 700,
      activeReminders: 4,
      totalInvoices: 10,
    });

    expect(snapshot).toEqual({
      recoveredShare: 70,
      outstandingShare: 30,
      reminderCoverage: 40,
    });
  });

  it('returns zeroed ratios when totals are empty', () => {
    const snapshot = calculateDashboardSnapshot({
      totalOutstanding: 0,
      recoveredThisMonth: 0,
      activeReminders: 3,
      totalInvoices: 0,
    });

    expect(snapshot).toEqual({
      recoveredShare: 0,
      outstandingShare: 0,
      reminderCoverage: 0,
    });
  });
});
