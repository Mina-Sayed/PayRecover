import { Prisma } from '@prisma/client';
import { decimalToNumber } from '@/lib/money';

export const dashboardRecentInvoiceInclude = {
  client: {
    select: {
      id: true,
      name: true,
      phone: true,
    },
  },
} satisfies Prisma.InvoiceInclude;

export type DashboardRecentInvoiceRecord = Prisma.InvoiceGetPayload<{
  include: typeof dashboardRecentInvoiceInclude;
}>;

export function serializeDashboardRecentInvoice(invoice: DashboardRecentInvoiceRecord) {
  return {
    id: invoice.id,
    invoiceNo: invoice.invoiceNo,
    amount: decimalToNumber(invoice.amount),
    dueDate: invoice.dueDate.toISOString(),
    status: invoice.status,
    client: invoice.client,
  };
}
