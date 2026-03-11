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

export const dashboardRecentActivityInclude = {
  invoice: {
    select: {
      id: true,
      invoiceNo: true,
    },
  },
} satisfies Prisma.InvoiceEventInclude;

export type DashboardRecentActivityRecord = Prisma.InvoiceEventGetPayload<{
  include: typeof dashboardRecentActivityInclude;
}>;

export function serializeDashboardRecentActivity(event: DashboardRecentActivityRecord) {
  return {
    id: event.id,
    type: event.type,
    message: event.message,
    createdAt: event.createdAt.toISOString(),
    invoice: event.invoice,
  };
}
