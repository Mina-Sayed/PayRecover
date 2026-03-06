const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function asOptionalTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  return value.trim();
}

export function asEmail(value: unknown): string | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (!normalized) return null;
  return EMAIL_REGEX.test(normalized) ? normalized : null;
}

export function asPositiveNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

export function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isInvoiceStatus(value: unknown): value is 'pending' | 'overdue' | 'paid' {
  return value === 'pending' || value === 'overdue' || value === 'paid';
}

export function isReminderChannel(value: unknown): value is 'whatsapp' | 'sms' {
  return value === 'whatsapp' || value === 'sms';
}
