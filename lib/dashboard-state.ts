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

/**
 * Clamp a numeric percentage into the inclusive range 0–100 after rounding; non-finite inputs yield 0.
 *
 * @param value - The numeric percentage to normalize; may be any finite or non-finite number.
 * @returns The input rounded to the nearest integer and constrained to [0, 100]; returns 0 for non-finite inputs.
 */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Compute percentage-based metrics for the dashboard: recovered share, outstanding share, and reminder coverage.
 *
 * @param input - Aggregated counts used to compute the snapshot:
 *   - `totalOutstanding`: total outstanding amount
 *   - `recoveredThisMonth`: amount recovered in the current month
 *   - `activeReminders`: number of reminders currently active
 *   - `totalInvoices`: total number of invoices
 * @returns An object with:
 *   - `recoveredShare` — percentage (0–100) of `recoveredThisMonth` relative to the sum of recovered and outstanding amounts
 *   - `outstandingShare` — percentage (0–100) of `totalOutstanding` relative to the sum of recovered and outstanding amounts
 *   - `reminderCoverage` — percentage (0–100) of `activeReminders` relative to `totalInvoices`
 */
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

/**
 * Produce a new invoice list with the specified invoice's status updated.
 *
 * @param invoices - Array of invoice drafts to update
 * @param invoiceId - ID of the invoice to change
 * @param status - New status to assign to the matching invoice
 * @returns A new array where the invoice with `id === invoiceId` has its `status` replaced; all other invoices are unchanged
 */
export function applyInvoiceStatusUpdate(
  invoices: InvoiceDraft[],
  invoiceId: string,
  status: 'pending' | 'overdue' | 'paid'
): InvoiceDraft[] {
  return invoices.map((invoice) =>
    invoice.id === invoiceId ? { ...invoice, status } : invoice
  );
}

/**
 * Merge the provided fields into the reminder that matches the given id.
 *
 * @param reminderId - The id of the reminder to update
 * @param patch - Partial fields (`timing`, `template`, `active`) to merge into the matching reminder
 * @returns An array of reminders where the reminder with `id === reminderId` has been merged with `patch`; other reminders are unchanged
 */
export function updateReminderDraft(
  reminders: ReminderDraft[],
  reminderId: string,
  patch: Partial<Pick<ReminderDraft, 'timing' | 'template' | 'active'>>
): ReminderDraft[] {
  return reminders.map((reminder) =>
    reminder.id === reminderId ? { ...reminder, ...patch } : reminder
  );
}

/**
 * Reassigns sequential order values to reminders based on their current array positions.
 *
 * @param reminders - The reminders to re-order
 * @returns A new array where each reminder's `order` equals its index in the returned array
 */
export function withReminderOrder(reminders: ReminderDraft[]): ReminderDraft[] {
  return reminders.map((reminder, index) => ({ ...reminder, order: index }));
}
