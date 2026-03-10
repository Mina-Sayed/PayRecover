import { describe, expect, it, vi } from 'vitest';

async function loadSettingsRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    messagingProviderConnection: {
      findFirst: vi.fn(),
    },
    paymentProviderConnection: {
      findFirst: vi.fn(),
    },
  };

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

  const route = await import('@/app/api/settings/route');
  return { route, authMock, prismaMock };
}

describe('/api/settings route handlers', () => {
  it('requires authentication to read settings', async () => {
    const { route, authMock } = await loadSettingsRoute();
    authMock.mockResolvedValue(null);

    const response = await route.GET();
    expect(response.status).toBe(401);
  });

  it('reads settings for the authenticated user only', async () => {
    const { route, authMock, prismaMock } = await loadSettingsRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover',
      whatsappNumber: '+971500000000',
      plan: 'free',
      notifyPaymentReceived: true,
      notifyDailySummary: true,
      notifyOverdueAlerts: true,
    });
    prismaMock.messagingProviderConnection.findFirst.mockResolvedValue(null);
    prismaMock.paymentProviderConnection.findFirst.mockResolvedValue(null);

    const response = await route.GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      name: 'Mina',
      email: 'mina@example.com',
      messagingConnection: {
        status: 'not_connected',
      },
      paymentConnection: {
        status: 'not_connected',
      },
      notificationPrefs: {
        paymentReceived: true,
        dailySummary: true,
        overdueAlerts: true,
      },
    });
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
        notifyPaymentReceived: true,
        notifyDailySummary: true,
        notifyOverdueAlerts: true,
      },
    });
  });

  it('updates editable fields for the authenticated user', async () => {
    const { route, authMock, prismaMock } = await loadSettingsRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.user.update.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover LLC',
      whatsappNumber: '+971500000001',
      plan: 'free',
      notifyPaymentReceived: true,
      notifyDailySummary: true,
      notifyOverdueAlerts: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover LLC',
      whatsappNumber: '+971500000001',
      plan: 'free',
      notifyPaymentReceived: true,
      notifyDailySummary: true,
      notifyOverdueAlerts: true,
    });
    prismaMock.messagingProviderConnection.findFirst.mockResolvedValue(null);
    prismaMock.paymentProviderConnection.findFirst.mockResolvedValue(null);

    const response = await route.PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mina',
          businessName: 'PayRecover LLC',
          whatsappNumber: '+971500000001',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      businessName: 'PayRecover LLC',
      whatsappNumber: '+971500000001',
      messagingConnection: {
        status: 'not_connected',
      },
      paymentConnection: {
        status: 'not_connected',
      },
      notificationPrefs: {
        paymentReceived: true,
        dailySummary: true,
        overdueAlerts: true,
      },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: 'Mina',
        businessName: 'PayRecover LLC',
        whatsappNumber: '+971500000001',
      },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
        notifyPaymentReceived: true,
        notifyDailySummary: true,
        notifyOverdueAlerts: true,
      },
    });
  });

  it('allows clearing nullable profile fields with empty strings', async () => {
    const { route, authMock, prismaMock } = await loadSettingsRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.user.update.mockResolvedValue({
      name: null,
      email: 'mina@example.com',
      businessName: null,
      whatsappNumber: null,
      plan: 'free',
      notifyPaymentReceived: true,
      notifyDailySummary: true,
      notifyOverdueAlerts: true,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      name: null,
      email: 'mina@example.com',
      businessName: null,
      whatsappNumber: null,
      plan: 'free',
      notifyPaymentReceived: true,
      notifyDailySummary: true,
      notifyOverdueAlerts: true,
    });
    prismaMock.messagingProviderConnection.findFirst.mockResolvedValue(null);
    prismaMock.paymentProviderConnection.findFirst.mockResolvedValue(null);

    const response = await route.PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '   ',
          businessName: '',
          whatsappNumber: ' ',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      name: null,
      businessName: null,
      whatsappNumber: null,
      messagingConnection: {
        status: 'not_connected',
      },
      paymentConnection: {
        status: 'not_connected',
      },
      notificationPrefs: {
        paymentReceived: true,
        dailySummary: true,
        overdueAlerts: true,
      },
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        name: null,
        businessName: null,
        whatsappNumber: null,
      },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
        notifyPaymentReceived: true,
        notifyDailySummary: true,
        notifyOverdueAlerts: true,
      },
    });
  });

  it('persists notification preferences', async () => {
    const { route, authMock, prismaMock } = await loadSettingsRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.user.update.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover',
      whatsappNumber: '+971500000000',
      plan: 'free',
      notifyPaymentReceived: false,
      notifyDailySummary: true,
      notifyOverdueAlerts: false,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      name: 'Mina',
      email: 'mina@example.com',
      businessName: 'PayRecover',
      whatsappNumber: '+971500000000',
      plan: 'free',
      notifyPaymentReceived: false,
      notifyDailySummary: true,
      notifyOverdueAlerts: false,
    });
    prismaMock.messagingProviderConnection.findFirst.mockResolvedValue(null);
    prismaMock.paymentProviderConnection.findFirst.mockResolvedValue(null);

    const response = await route.PUT(
      new Request('http://localhost/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notificationPrefs: {
            paymentReceived: false,
            dailySummary: true,
            overdueAlerts: false,
          },
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.notificationPrefs).toEqual({
      paymentReceived: false,
      dailySummary: true,
      overdueAlerts: false,
    });
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        notifyPaymentReceived: false,
        notifyDailySummary: true,
        notifyOverdueAlerts: false,
      },
      select: {
        name: true,
        email: true,
        businessName: true,
        whatsappNumber: true,
        plan: true,
        notifyPaymentReceived: true,
        notifyDailySummary: true,
        notifyOverdueAlerts: true,
      },
    });
  });
});
