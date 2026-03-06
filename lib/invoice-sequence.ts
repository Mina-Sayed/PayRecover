export function parseInvoiceSequence(invoiceNo: string): number {
  const match = /^INV-\d{4}-(\d+)$/.exec(invoiceNo);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getNextInvoiceNumber(existingInvoiceNos: string[], year = new Date().getFullYear()): string {
  const maxSequence = existingInvoiceNos.reduce((max, invoiceNo) => {
    const current = parseInvoiceSequence(invoiceNo);
    return current > max ? current : max;
  }, 0);

  return `INV-${year}-${String(maxSequence + 1).padStart(3, '0')}`;
}

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
