import { describe, expect, it } from 'vitest';
import {
  getNextInvoiceNumber,
  isInvoiceNumberConflict,
  parseInvoiceSequence,
} from '@/lib/invoice-sequence';

describe('invoice sequence helpers', () => {
  it('parses numeric sequence from valid invoice numbers', () => {
    expect(parseInvoiceSequence('INV-2026-042')).toBe(42);
  });

  it('returns 0 for invalid invoice number formats', () => {
    expect(parseInvoiceSequence('INV-26-042')).toBe(0);
    expect(parseInvoiceSequence('OTHER-2026-042')).toBe(0);
  });

  it('generates the next invoice number from the highest existing sequence', () => {
    const next = getNextInvoiceNumber(
      ['INV-2026-001', 'INV-2026-007', 'INV-2026-003'],
      2026
    );
    expect(next).toBe('INV-2026-008');
  });

  it('detects prisma unique conflicts for invoice numbers', () => {
    expect(
      isInvoiceNumberConflict({
        code: 'P2002',
        meta: { target: ['userId', 'invoiceNo'] },
      })
    ).toBe(true);
    expect(
      isInvoiceNumberConflict({
        code: 'P2002',
        meta: { target: 'Invoice_userId_invoiceNo_key' },
      })
    ).toBe(true);
  });

  it('ignores non-invoice prisma errors', () => {
    expect(isInvoiceNumberConflict({ code: 'P2002', meta: { target: ['email'] } })).toBe(false);
    expect(isInvoiceNumberConflict({ code: 'P2025' })).toBe(false);
    expect(isInvoiceNumberConflict(null)).toBe(false);
  });
});
