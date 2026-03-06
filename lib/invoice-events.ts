export type InvoiceEventType =
  | 'invoice_created'
  | 'invoice_details_updated'
  | 'invoice_client_updated'
  | 'invoice_marked_paid'
  | 'invoice_status_recalculated';

export function formatInvoiceEventMessage(
  type: InvoiceEventType,
  details?: string
): string {
  if (details) {
    return details;
  }

  switch (type) {
    case 'invoice_created':
      return 'Invoice created';
    case 'invoice_details_updated':
      return 'Invoice details updated';
    case 'invoice_client_updated':
      return 'Client contact details updated';
    case 'invoice_marked_paid':
      return 'Invoice marked as paid';
    case 'invoice_status_recalculated':
      return 'Invoice status recalculated from due date';
  }
}
