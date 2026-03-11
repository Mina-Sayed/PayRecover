import { describe, expect, it, vi } from 'vitest';

async function loadRemindersRouteWithRpcFallback() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    reminderTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };
  const rpcMock = vi.fn();
  const ensureFallbackUserProfileMock = vi.fn();

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/supabase-rpc', async () => {
    const actual = await vi.importActual<typeof import('@/lib/supabase-rpc')>('@/lib/supabase-rpc');

    return {
      ...actual,
      callSupabaseRpc: rpcMock,
      ensureFallbackUserProfile: ensureFallbackUserProfileMock,
    };
  });

  const route = await import('@/app/api/reminders/route');
  return { route, authMock, prismaMock, rpcMock, ensureFallbackUserProfileMock };
}

describe('reminders route RPC fallback', () => {
  it('falls back to Supabase RPC when Prisma cannot reach the database', async () => {
    const { route, authMock, prismaMock, rpcMock } = await loadRemindersRouteWithRpcFallback();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.reminderTemplate.findMany.mockRejectedValue({
      code: 'ENETUNREACH',
      message: 'connect ENETUNREACH',
    });
    rpcMock.mockResolvedValue([
      {
        id: 'rem-1',
        channel: 'whatsapp',
        timing: 'On Due Date',
        template: 'Pay now',
        providerTemplateName: null,
        active: true,
        order: 0,
      },
    ]);

    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(rpcMock).toHaveBeenCalledWith(
      'app_get_reminders',
      expect.objectContaining({ p_user_id: 'user-1' })
    );
  });

  it('bootstraps the user profile before creating a reminder through RPC fallback', async () => {
    const { route, authMock, prismaMock, rpcMock, ensureFallbackUserProfileMock } =
      await loadRemindersRouteWithRpcFallback();
    authMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'mina@example.com',
        name: 'Mina',
      },
    });
    prismaMock.reminderTemplate.findFirst.mockRejectedValue({
      code: 'ENETUNREACH',
      message: 'connect ENETUNREACH',
    });
    ensureFallbackUserProfileMock.mockResolvedValue({
      id: 'user-1',
      email: 'mina@example.com',
      name: 'Mina',
      businessName: 'Mina',
      whatsappNumber: null,
      plan: 'free',
      notifyPaymentReceived: true,
      notifyDailySummary: true,
      notifyOverdueAlerts: true,
    });
    rpcMock.mockResolvedValueOnce({
        id: 'rem-1',
        channel: 'whatsapp',
        timing: '3 Days Before Due',
        template: 'Pay now',
        providerTemplateName: null,
        active: true,
        order: 0,
      });

    const response = await route.POST(
      new Request('http://localhost/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'whatsapp',
          timing: '3 Days Before Due',
          template: 'Pay now',
          providerTemplateName: '',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ id: 'rem-1' });
    expect(ensureFallbackUserProfileMock).toHaveBeenCalledWith(
      {
        id: 'user-1',
        email: 'mina@example.com',
        name: 'Mina',
      },
      expect.any(String)
    );
    expect(rpcMock).toHaveBeenNthCalledWith(
      1,
      'app_create_reminder',
      expect.objectContaining({
        p_user_id: 'user-1',
      })
    );
  });
});
