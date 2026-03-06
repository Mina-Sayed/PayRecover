export interface ReminderDraft {
  id: string;
  timing: string;
  template: string;
  active: boolean;
  order: number;
  channel: 'whatsapp' | 'sms';
}

export interface InvoiceDraft {
  id: string;
  status: 'pending' | 'overdue' | 'paid';
  amount: number;
}

interface DashboardSnapshotInput {
  totalOutstanding: number;
  recoveredThisMonth: number;
  activeReminders: number;
  totalInvoices: number;
}

export interface DashboardSnapshot {
  recoveredShare: number;
  outstandingShare: number;
  reminderCoverage: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateDashboardSnapshot(input: DashboardSnapshotInput): DashboardSnapshot {
  const totalFinancial = input.totalOutstanding + input.recoveredThisMonth;
  const recoveredShare =
    totalFinancial > 0 ? (input.recoveredThisMonth / totalFinancial) * 100 : 0;
  const outstandingShare =
    totalFinancial > 0 ? (input.totalOutstanding / totalFinancial) * 100 : 0;
  const reminderCoverage =
    input.totalInvoices > 0 ? (input.activeReminders / input.totalInvoices) * 100 : 0;

  return {
    recoveredShare: clampPercent(recoveredShare),
    outstandingShare: clampPercent(outstandingShare),
    reminderCoverage: clampPercent(reminderCoverage),
  };
}

export function applyInvoiceStatusUpdate(
  invoices: InvoiceDraft[],
  invoiceId: string,
  status: 'pending' | 'overdue' | 'paid'
): InvoiceDraft[] {
  return invoices.map((invoice) =>
    invoice.id === invoiceId ? { ...invoice, status } : invoice
  );
}

export function updateReminderDraft(
  reminders: ReminderDraft[],
  reminderId: string,
  patch: Partial<Pick<ReminderDraft, 'timing' | 'template' | 'active'>>
): ReminderDraft[] {
  return reminders.map((reminder) =>
    reminder.id === reminderId ? { ...reminder, ...patch } : reminder
  );
}

export function withReminderOrder(reminders: ReminderDraft[]): ReminderDraft[] {
  return reminders.map((reminder, index) => ({ ...reminder, order: index }));
}
