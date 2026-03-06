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

export function getInvoiceStatusCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  return cutoff;
}

export function getDerivedOpenInvoiceStatus(
  dueDate: Date,
  now = new Date()
): Exclude<InvoiceStatus, 'paid'> {
  return dueDate < getInvoiceStatusCutoff(now) ? 'overdue' : 'pending';
}

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
