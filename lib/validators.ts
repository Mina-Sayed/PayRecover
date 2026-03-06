const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Checks whether a value is a non-null object (suitable as a record).
 *
 * @returns `true` if `value` is an object and not `null`, `false` otherwise.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Normalize an input by returning its trimmed, non-empty string form or `null`.
 *
 * @param value - The value to normalize; must be a string to succeed.
 * @returns The trimmed string if `value` is a string with at least one non-whitespace character, `null` otherwise.
 */
export function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize an optional input to a trimmed string or `null`.
 *
 * @param value - The input to normalize; may be `undefined`, `null`, or any other type.
 * @returns The trimmed string when `value` is a string, `null` if `value` is `undefined`, `null`, or not a string. The trimmed result may be an empty string.
 */
export function asOptionalTrimmedString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') return null;
  return value.trim();
}

/**
 * Normalize and validate an email string, returning the lowercased trimmed value when valid.
 *
 * @param value - Input to normalize and validate; non-string or empty values produce `null`.
 * @returns The lowercased, trimmed email string if it matches the email pattern, `null` otherwise.
 */
export function asEmail(value: unknown): string | null {
  const normalized = asTrimmedString(value)?.toLowerCase();
  if (!normalized) return null;
  return EMAIL_REGEX.test(normalized) ? normalized : null;
}

/**
 * Parse and validate a positive number from an arbitrary input.
 *
 * @param value - Input to parse; may be a number or any value coercible to a number (for example, a numeric string)
 * @returns `number` if `value` represents a finite number greater than zero, `null` otherwise
 */
export function asPositiveNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

/**
 * Converts a string or Date into a valid Date object.
 *
 * @param value - The input value; accepted types are `string` or `Date`.
 * @returns A `Date` representing the input if it can be parsed, `null` otherwise.
 */
export function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/**
 * Checks whether a value is one of the allowed invoice statuses.
 *
 * @param value - Value to test
 * @returns `true` if `value` is `'pending'`, `'overdue'`, or `'paid'`, `false` otherwise.
 */
export function isInvoiceStatus(value: unknown): value is 'pending' | 'overdue' | 'paid' {
  return value === 'pending' || value === 'overdue' || value === 'paid';
}

/**
 * Determines whether a value is a supported reminder channel.
 *
 * @param value - The value to test.
 * @returns `true` if `value` is 'whatsapp' or 'sms', `false` otherwise.
 */
export function isReminderChannel(value: unknown): value is 'whatsapp' | 'sms' {
  return value === 'whatsapp' || value === 'sms';
}
