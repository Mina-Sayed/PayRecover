import { describe, expect, it, vi } from 'vitest';

async function loadSettingsRouteWithRpcFallback() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
    },
    messagingProviderConnection: {
      findFirst: vi.fn(),
    },
    paymentProviderConnection: {
      findFirst: vi.fn(),
    },
  };
  const rpcMock = vi.fn();
  const ensureFallbackUserProfileMock = vi.fn(
    async (user: { id: string; email?: string | null; name?: string | null }) => ({
      id: user.id,
      email: user.email ?? `${user.id}@payrecover.local`,
      name: user.name ?? null,
      businessName: user.name ?? null,
      whatsappNumber: null,
      plan: 'free',
      notifyPaymentReceived: true,
      notifyDailySummary: true,
      notifyOverdueAlerts: true,
    })
  );

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

  const route = await import('@/app/api/settings/route');
  return { route, authMock, prismaMock, rpcMock, ensureFallbackUserProfileMock };
}

describe('settings route RPC fallback', () => {
  it('bootstraps a missing user profile when the fallback settings RPC returns null', async () => {
    const { route, authMock, prismaMock, rpcMock, ensureFallbackUserProfileMock } =
      await loadSettingsRouteWithRpcFallback();
    authMock.mockResolvedValue({
      user: {
        id: 'user-1',
        email: 'mina@example.com',
        name: 'Mina',
      },
    });
    prismaMock.user.findUnique.mockRejectedValue({
      code: 'ENETUNREACH',
      message: 'connect ENETUNREACH',
    });
    prismaMock.messagingProviderConnection.findFirst.mockRejectedValue({
      code: 'ENETUNREACH',
      message: 'connect ENETUNREACH',
    });
    prismaMock.paymentProviderConnection.findFirst.mockRejectedValue({
      code: 'ENETUNREACH',
      message: 'connect ENETUNREACH',
    });
    rpcMock.mockResolvedValue(null);

    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      email: 'mina@example.com',
      plan: 'free',
      notificationPrefs: {
        paymentReceived: true,
        dailySummary: true,
        overdueAlerts: true,
      },
      messagingConnection: {
        status: 'not_connected',
      },
      paymentConnection: {
        status: 'not_connected',
      },
    });
    expect(rpcMock).toHaveBeenCalledWith(
      'app_get_settings',
      expect.objectContaining({
        p_user_id: 'user-1',
      })
    );
    expect(ensureFallbackUserProfileMock).toHaveBeenCalledWith(
      {
        id: 'user-1',
        email: 'mina@example.com',
        name: 'Mina',
      },
      expect.any(String)
    );
  });
});
