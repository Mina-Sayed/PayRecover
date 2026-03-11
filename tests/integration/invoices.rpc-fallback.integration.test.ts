import { describe, expect, it, vi } from 'vitest';

async function loadInvoicesRouteWithRpcFallback() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    invoice: {
      updateMany: vi.fn(),
    },
  };
  const rpcMock = vi.fn();

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/supabase-rpc', () => ({
    callSupabaseRpc: rpcMock,
  }));
  vi.doMock('@/lib/recovery-loop', () => ({
    ensureInvoiceOperationalArtifacts: vi.fn(),
    suppressReminderRunsForInvoice: vi.fn(),
  }));

  const route = await import('@/app/api/invoices/route');
  return { route, authMock, prismaMock, rpcMock };
}

describe('invoices route RPC fallback', () => {
  it('falls back to Supabase RPC when invoice status sync cannot reach the database', async () => {
    const { route, authMock, prismaMock, rpcMock } = await loadInvoicesRouteWithRpcFallback();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.invoice.updateMany.mockRejectedValue({
      code: 'ENETUNREACH',
      message: 'connect ENETUNREACH',
    });
    rpcMock.mockResolvedValue({
      invoices: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });

    const response = await route.GET(new Request('http://localhost/api/invoices'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      invoices: [],
      total: 0,
      page: 1,
      totalPages: 1,
    });
    expect(rpcMock).toHaveBeenCalledWith(
      'app_list_invoices',
      expect.objectContaining({ p_user_id: 'user-1' })
    );
  });
});
