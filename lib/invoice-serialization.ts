import { Prisma } from '@prisma/client';
import { decimalToNumber } from '@/lib/money';

export interface PaymentLinkSummary {
  provider: string;
  status: string;
  url: string;
  expiresAt: string | null;
}

type InvoiceRecord = {
  id: string;
  invoiceNo: string;
  amount: Prisma.Decimal | number | string;
  dueDate: Date | string;
  status: string;
  notes: string | null;
  paidAt?: Date | string | null;
  currency: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  client: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
  };
  events?: Array<{
    id: string;
    type: string;
    message: string;
    createdAt: Date | string;
  }>;
  paymentLinks?: Array<{
    provider: string;
    status: string;
    url: string;
    expiresAt: Date | string | null;
  }>;
};

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

export function toPaymentLinkSummary(
  paymentLinks?: Array<{
    provider: string;
    status: string;
    url: string;
    expiresAt: Date | string | null;
  }>
): PaymentLinkSummary | null {
  const current = paymentLinks?.[0];
  if (!current) {
    return null;
  }

  return {
    provider: current.provider,
    status: current.status,
    url: current.url,
    expiresAt: toIsoString(current.expiresAt),
  };
}

export function serializeInvoice(record: InvoiceRecord) {
  return {
    id: record.id,
    invoiceNo: record.invoiceNo,
    amount: decimalToNumber(record.amount),
    dueDate: toIsoString(record.dueDate)!,
    status: record.status,
    notes: record.notes,
    paidAt: toIsoString(record.paidAt),
    currency: record.currency,
    createdAt: toIsoString(record.createdAt),
    updatedAt: toIsoString(record.updatedAt),
    client: record.client,
    events: (record.events ?? []).map((event) => ({
      ...event,
      createdAt: toIsoString(event.createdAt)!,
    })),
    paymentLink: toPaymentLinkSummary(record.paymentLinks),
  };
}
