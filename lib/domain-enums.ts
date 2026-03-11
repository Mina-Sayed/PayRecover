export const PaymentLinkStatus = {
  active: 'active',
  expired: 'expired',
  paid: 'paid',
  failed: 'failed',
} as const;

export type PaymentLinkStatus = (typeof PaymentLinkStatus)[keyof typeof PaymentLinkStatus];

export const ProviderConnectionStatus = {
  draft: 'draft',
  configured: 'configured',
  verified: 'verified',
  errored: 'errored',
  disabled: 'disabled',
} as const;

export type ProviderConnectionStatus =
  (typeof ProviderConnectionStatus)[keyof typeof ProviderConnectionStatus];

export const ProviderConnectionMode = {
  sandbox: 'sandbox',
  live: 'live',
} as const;

export type ProviderConnectionMode =
  (typeof ProviderConnectionMode)[keyof typeof ProviderConnectionMode];

export const MessagingProviderKind = {
  wati: 'wati',
} as const;

export type MessagingProviderKind = (typeof MessagingProviderKind)[keyof typeof MessagingProviderKind];

export const PaymentProviderKind = {
  paymob: 'paymob',
} as const;

export type PaymentProviderKind = (typeof PaymentProviderKind)[keyof typeof PaymentProviderKind];

export const ReminderRunStatus = {
  scheduled: 'scheduled',
  sending: 'sending',
  sent: 'sent',
  delivered: 'delivered',
  failed: 'failed',
  suppressed: 'suppressed',
  cancelled: 'cancelled',
} as const;

export type ReminderRunStatus = (typeof ReminderRunStatus)[keyof typeof ReminderRunStatus];
