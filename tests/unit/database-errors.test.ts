import { describe, expect, it } from 'vitest';
import { isDatabaseConnectivityError } from '@/lib/database-errors';

describe('database connectivity errors', () => {
  it('detects network-layer database failures by code', () => {
    expect(isDatabaseConnectivityError({ code: 'ENETUNREACH' })).toBe(true);
    expect(isDatabaseConnectivityError({ code: 'ECONNREFUSED' })).toBe(true);
  });

  it('detects timeout-style database failures by message', () => {
    expect(isDatabaseConnectivityError({ message: 'timeout expired while connecting' })).toBe(true);
    expect(isDatabaseConnectivityError({ message: 'connect ENETUNREACH 2a05:d018::5432' })).toBe(true);
    expect(
      isDatabaseConnectivityError({
        code: 'P1001',
        message: "Can't reach database server at db.fkweqrvrmsydmhrjgagr.supabase.co",
      })
    ).toBe(true);
  });

  it('does not classify unrelated errors as connectivity failures', () => {
    expect(isDatabaseConnectivityError({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false);
    expect(isDatabaseConnectivityError(new Error('something else'))).toBe(false);
  });
});
