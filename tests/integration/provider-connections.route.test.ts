import { describe, expect, it, vi } from 'vitest';
import { encryptProviderConfig } from '@/lib/provider-connections';

async function loadMessagingRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    messagingProviderConnection: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

  const route = await import('@/app/api/provider-connections/messaging/route');
  return { route, authMock, prismaMock };
}

async function loadMessagingVerifyRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const syncOperationalArtifactsForUserMock = vi.fn(async () => ({
    invoicesScanned: 3,
    paymentLinksCreated: 1,
    reminderRunsCreated: 2,
  }));
  const prismaMock = {
    messagingProviderConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/wati', () => ({
    verifyWatiConnection: vi.fn(async () => ({ ok: true, error: null })),
  }));
  vi.doMock('@/lib/recovery-loop', () => ({
    syncOperationalArtifactsForUser: syncOperationalArtifactsForUserMock,
  }));

  const route = await import('@/app/api/provider-connections/messaging/[id]/verify/route');
  return { route, authMock, prismaMock, syncOperationalArtifactsForUserMock };
}

async function loadPaymentVerifyRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const syncOperationalArtifactsForUserMock = vi.fn(async () => ({
    invoicesScanned: 4,
    paymentLinksCreated: 2,
    reminderRunsCreated: 5,
  }));
  const prismaMock = {
    paymentProviderConnection: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));
  vi.doMock('@/lib/paymob', () => ({
    verifyPaymobConnection: vi.fn(async () => ({ ok: true, error: null })),
  }));
  vi.doMock('@/lib/recovery-loop', () => ({
    syncOperationalArtifactsForUser: syncOperationalArtifactsForUserMock,
  }));

  const route = await import('@/app/api/provider-connections/payments/[id]/verify/route');
  return { route, authMock, prismaMock, syncOperationalArtifactsForUserMock };
}

describe('provider connection routes', () => {
  it('saves a tenant WATI connection', async () => {
    const { route, authMock, prismaMock } = await loadMessagingRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.messagingProviderConnection.findFirst.mockResolvedValue(null);
    prismaMock.messagingProviderConnection.create.mockResolvedValue({
      id: 'msg-1',
      provider: 'wati',
      mode: 'sandbox',
      status: 'configured',
      accountLabel: 'Clinic WATI',
      senderIdentifier: '971500000000',
      encryptedConfig: encryptProviderConfig({
        apiBaseUrl: 'https://wati.example.com',
        accessToken: 'token',
        webhookSecret: 'secret',
      }),
      verifiedAt: null,
      lastHealthcheckAt: null,
      lastError: null,
    });

    const response = await route.POST(
      new Request('http://localhost/api/provider-connections/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountLabel: 'Clinic WATI',
          senderIdentifier: '971500000000',
          mode: 'sandbox',
          apiBaseUrl: 'https://wati.example.com',
          accessToken: 'token',
          webhookSecret: 'secret',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      messagingConnection: {
        id: 'msg-1',
        status: 'configured',
      },
    });
    expect(prismaMock.messagingProviderConnection.create).toHaveBeenCalledTimes(1);
  });

  it('rejects unsafe provider hosts before saving a WATI connection', async () => {
    const { route, authMock, prismaMock } = await loadMessagingRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.messagingProviderConnection.findFirst.mockResolvedValue(null);

    const response = await route.POST(
      new Request('http://localhost/api/provider-connections/messaging', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountLabel: 'Clinic WATI',
          senderIdentifier: '971500000000',
          mode: 'sandbox',
          apiBaseUrl: 'https://malicious.internal',
          accessToken: 'token',
          webhookSecret: 'secret',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: 'WATI base URL host is not allowlisted',
      code: 'VALIDATION_ERROR',
    });
    expect(prismaMock.messagingProviderConnection.create).not.toHaveBeenCalled();
  });

  it('verifies a tenant WATI connection and backfills eligible invoices', async () => {
    const { route, authMock, prismaMock, syncOperationalArtifactsForUserMock } =
      await loadMessagingVerifyRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.messagingProviderConnection.findFirst.mockResolvedValue({
      id: 'msg-1',
      userId: 'user-1',
      provider: 'wati',
      mode: 'sandbox',
      status: 'configured',
      accountLabel: 'Clinic WATI',
      senderIdentifier: '971500000000',
      encryptedConfig: encryptProviderConfig({
        apiBaseUrl: 'https://wati.example.com',
        accessToken: 'token',
        webhookSecret: 'secret',
      }),
      verifiedAt: null,
      lastHealthcheckAt: null,
      lastError: null,
    });
    prismaMock.messagingProviderConnection.update.mockResolvedValue({
      id: 'msg-1',
      provider: 'wati',
      mode: 'sandbox',
      status: 'verified',
      accountLabel: 'Clinic WATI',
      senderIdentifier: '971500000000',
      encryptedConfig: encryptProviderConfig({
        apiBaseUrl: 'https://wati.example.com',
        accessToken: 'token',
        webhookSecret: 'secret',
      }),
      verifiedAt: new Date('2026-03-08T00:00:00.000Z'),
      lastHealthcheckAt: new Date('2026-03-08T00:00:00.000Z'),
      lastError: null,
    });

    const response = await route.POST(
      new Request('http://localhost/api/provider-connections/messaging/msg-1/verify', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'msg-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      messagingConnection: {
        id: 'msg-1',
        status: 'verified',
      },
      operationalSync: {
        invoicesScanned: 3,
        paymentLinksCreated: 1,
        reminderRunsCreated: 2,
      },
    });
    expect(syncOperationalArtifactsForUserMock).toHaveBeenCalledWith(prismaMock, 'user-1');
  });

  it('verifies a tenant Paymob connection and marks it verified', async () => {
    const { route, authMock, prismaMock, syncOperationalArtifactsForUserMock } = await loadPaymentVerifyRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.paymentProviderConnection.findFirst.mockResolvedValue({
      id: 'pay-1',
      userId: 'user-1',
      provider: 'paymob',
      mode: 'sandbox',
      status: 'configured',
      accountLabel: 'Clinic Paymob',
      encryptedConfig: encryptProviderConfig({
        publicKey: 'pk_test_123',
        secretKey: 'sk_test_123',
        integrationId: '123456',
        hmacSecret: 'hmac',
        apiBaseUrl: 'https://accept.paymob.com',
      }),
      verifiedAt: null,
      lastHealthcheckAt: null,
      lastError: null,
    });
    prismaMock.paymentProviderConnection.update.mockResolvedValue({
      id: 'pay-1',
      provider: 'paymob',
      mode: 'sandbox',
      status: 'verified',
      accountLabel: 'Clinic Paymob',
      encryptedConfig: encryptProviderConfig({
        publicKey: 'pk_test_123',
        secretKey: 'sk_test_123',
        integrationId: '123456',
        hmacSecret: 'hmac',
        apiBaseUrl: 'https://accept.paymob.com',
      }),
      verifiedAt: new Date('2026-03-08T00:00:00.000Z'),
      lastHealthcheckAt: new Date('2026-03-08T00:00:00.000Z'),
      lastError: null,
    });

    const response = await route.POST(
      new Request('http://localhost/api/provider-connections/payments/pay-1/verify', {
        method: 'POST',
      }),
      { params: Promise.resolve({ id: 'pay-1' }) }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      paymentConnection: {
        id: 'pay-1',
        status: 'verified',
      },
      operationalSync: {
        invoicesScanned: 4,
        paymentLinksCreated: 2,
        reminderRunsCreated: 5,
      },
    });
    expect(prismaMock.paymentProviderConnection.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'pay-1' },
        data: expect.objectContaining({
          status: 'verified',
        }),
      })
    );
    expect(syncOperationalArtifactsForUserMock).toHaveBeenCalledWith(prismaMock, 'user-1');
  });
});
