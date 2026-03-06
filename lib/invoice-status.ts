export type InvoiceStatus = 'pending' | 'overdue' | 'paid';

interface InvoiceStatusSyncClient {
  invoice: {
    updateMany(args: {
      where: {
        userId: string;
        status: 'pending' | 'overdue';
        dueDate: { lt?: Date; gte?: Date };
      };
      data: { status: 'pending' | 'overdue' };
    }): Promise<unknown>;
  };
}

/**
 * Compute the UTC start-of-day cutoff for a given reference time.
 *
 * @param now - Reference date/time used to compute the cutoff; defaults to the current date/time
 * @returns A `Date` representing the same calendar day as `now` at 00:00:00.000 UTC
 */
export function getInvoiceStatusCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

/**
 * Determine an open invoice status from its due date relative to the UTC start of a given day.
 *
 * @param dueDate - The invoice's due date to evaluate.
 * @param now - Reference date used to compute the UTC day cutoff; defaults to the current date.
 * @returns `overdue` if `dueDate` is earlier than the UTC start of `now`'s day, `pending` otherwise.
 */
export function getDerivedOpenInvoiceStatus(
  dueDate: Date,
  now = new Date()
): Exclude<InvoiceStatus, 'paid'> {
  return dueDate < getInvoiceStatusCutoff(now) ? 'overdue' : 'pending';
}

/**
 * Determine the effective invoice status given its due date and current status.
 *
 * @param dueDate - The invoice's due date used to derive open statuses
 * @param status - The current stored invoice status
 * @param now - Reference date for cutoff calculations (defaults to current date/time)
 * @returns `'paid'` if the input `status` is `'paid'`, otherwise `'pending'` or `'overdue'` as derived from `dueDate`
 */
export function getEffectiveInvoiceStatus(
  dueDate: Date,
  status: InvoiceStatus,
  now = new Date()
): InvoiceStatus {
  if (status === 'paid') {
    return 'paid';
  }

  return getDerivedOpenInvoiceStatus(dueDate, now);
}

/**
 * Synchronizes open invoice statuses for a user to reflect the UTC start-of-day cutoff.
 *
 * Updates invoices so that those with status `pending` and due date earlier than the UTC start
 * of the provided day become `overdue`, and those with status `overdue` and due date on or after
 * the cutoff become `pending`; both updates are executed concurrently.
 *
 * @param userId - The user identifier whose invoices will be synchronized
 * @param now - Optional reference date used to compute the UTC start-of-day cutoff; defaults to the current date
 */
export async function syncOpenInvoiceStatuses(
  client: InvoiceStatusSyncClient,
  userId: string,
  now = new Date()
): Promise<void> {
  const cutoff = getInvoiceStatusCutoff(now);

  await Promise.all([
    client.invoice.updateMany({
      where: {
        userId,
        status: 'pending',
        dueDate: { lt: cutoff },
      },
      data: { status: 'overdue' },
    }),
    client.invoice.updateMany({
      where: {
        userId,
        status: 'overdue',
        dueDate: { gte: cutoff },
      },
      data: { status: 'pending' },
    }),
  ]);
}
