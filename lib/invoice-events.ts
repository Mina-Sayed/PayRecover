export type InvoiceEventType =
  | 'invoice_created'
  | 'invoice_details_updated'
  | 'invoice_client_updated'
  | 'invoice_marked_paid'
  | 'invoice_status_recalculated'
  | 'payment_link_created'
  | 'payment_link_failed'
  | 'payment_confirmed'
  | 'reminder_sent'
  | 'reminder_failed'
  | 'reminder_delivered'
  | 'reminders_suppressed';

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
    case 'payment_link_created':
      return 'Payment link created';
    case 'payment_link_failed':
      return 'Payment link creation failed';
    case 'payment_confirmed':
      return 'Payment confirmed by provider';
    case 'reminder_sent':
      return 'Reminder sent';
    case 'reminder_failed':
      return 'Reminder failed';
    case 'reminder_delivered':
      return 'Reminder delivered';
    case 'reminders_suppressed':
      return 'Future reminders suppressed';
  }
}
