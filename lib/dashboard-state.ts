export interface ReminderDraft {
  id: string;
  timing: string;
  template: string;
  providerTemplateName: string | null;
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
  remindersSentLast7Days: number;
  remindersDeliveredLast7Days: number;
  remindersFailedLast7Days: number;
  dueReminderRuns: number;
  totalInvoices: number;
}

export interface DashboardSnapshot {
  deliveryRate: number;
  failureRate: number;
  queueCoverage: number;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function calculateDashboardSnapshot(input: DashboardSnapshotInput): DashboardSnapshot {
  const deliveryRate =
    input.remindersSentLast7Days > 0
      ? (input.remindersDeliveredLast7Days / input.remindersSentLast7Days) * 100
      : 0;
  const processedReminderRuns = input.remindersDeliveredLast7Days + input.remindersFailedLast7Days;
  const failureRate =
    processedReminderRuns > 0
      ? (input.remindersFailedLast7Days / processedReminderRuns) * 100
      : 0;
  const queueCoverage =
    input.totalInvoices > 0 ? (input.dueReminderRuns / input.totalInvoices) * 100 : 0;

  return {
    deliveryRate: clampPercent(deliveryRate),
    failureRate: clampPercent(failureRate),
    queueCoverage: clampPercent(queueCoverage),
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
  patch: Partial<Pick<ReminderDraft, 'timing' | 'template' | 'providerTemplateName' | 'active'>>
): ReminderDraft[] {
  return reminders.map((reminder) =>
    reminder.id === reminderId ? { ...reminder, ...patch } : reminder
  );
}

export function withReminderOrder(reminders: ReminderDraft[]): ReminderDraft[] {
  return reminders.map((reminder, index) => ({ ...reminder, order: index }));
}
