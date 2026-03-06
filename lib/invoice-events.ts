export type InvoiceEventType =
  | 'invoice_created'
  | 'invoice_details_updated'
  | 'invoice_client_updated'
  | 'invoice_marked_paid'
  | 'invoice_status_recalculated';

/**
 * Create a human-readable message for an invoice event.
 *
 * @param details - Optional custom message that, when provided, overrides the default message for the given `type`
 * @returns The message corresponding to `type`, or `details` if provided
 */
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
