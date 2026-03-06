/**
 * Extracts the numeric sequence from an invoice identifier of the form `INV-YYYY-<sequence>`.
 *
 * @param invoiceNo - Invoice string expected to match pattern `INV-<4-digit year>-<sequence>`
 * @returns The parsed sequence number, or `0` if the input does not match the expected format or the sequence is not a finite number
 */
export function parseInvoiceSequence(invoiceNo: string): number {
  const match = /^INV-\d{4}-(\d+)$/.exec(invoiceNo);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Generate the next invoice number for a given year based on existing invoice numbers.
 *
 * @param existingInvoiceNos - Array of invoice numbers (expected format: `INV-YYYY-<sequence>`) to consider when computing the next sequence.
 * @param year - Four-digit year to include in the generated invoice number (defaults to the current year).
 * @returns The next invoice number in the form `INV-<year>-<sequence>`, where `sequence` is one greater than the highest parsed sequence from `existingInvoiceNos` and is left-padded to at least 3 digits (e.g., `INV-2026-005`).
 */
export function getNextInvoiceNumber(existingInvoiceNos: string[], year = new Date().getFullYear()): string {
  const maxSequence = existingInvoiceNos.reduce((max, invoiceNo) => {
    const current = parseInvoiceSequence(invoiceNo);
    return current > max ? current : max;
  }, 0);

  return `INV-${year}-${String(maxSequence + 1).padStart(3, '0')}`;
}

/**
 * Determines whether an error represents an invoice number unique-constraint conflict.
 *
 * Checks for an object error with `code === 'P2002'`. If present, inspects `meta.target`:
 * - absent `target` indicates a conflict,
 * - array `target` returns true if any element equals `'invoiceNo'`,
 * - string `target` returns true if it includes `'invoiceNo'`.
 *
 * @param error - The error value to inspect (typically a database/client error object).
 * @returns `true` if the error indicates a conflict involving `invoiceNo`, `false` otherwise.
 */
export function isInvoiceNumberConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as {
    code?: string;
    meta?: { target?: unknown };
  };

  if (candidate.code !== 'P2002') {
    return false;
  }

  const target = candidate.meta?.target;
  if (!target) {
    return true;
  }

  if (Array.isArray(target)) {
    return target.some((field) => field === 'invoiceNo');
  }

  if (typeof target === 'string') {
    return target.includes('invoiceNo');
  }

  return false;
}
