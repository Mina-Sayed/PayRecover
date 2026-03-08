import { describe, expect, it, vi } from 'vitest';

async function loadRemindersRoute() {
  vi.resetModules();

  const authMock = vi.fn();
  const prismaMock = {
    reminderTemplate: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  };

  vi.doMock('@/lib/auth', () => ({ auth: authMock }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

  const route = await import('@/app/api/reminders/route');
  return { route, authMock, prismaMock };
}

describe('/api/reminders route handlers', () => {
  it('rejects unauthenticated reminder updates', async () => {
    const { route, authMock } = await loadRemindersRoute();
    authMock.mockResolvedValue(null);

    const response = await route.PUT(
      new Request('http://localhost/api/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: [] }),
      })
    );

    expect(response.status).toBe(401);
  });

  it('updates reminder batch with per-user scoping', async () => {
    const { route, authMock, prismaMock } = await loadRemindersRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.reminderTemplate.updateMany.mockResolvedValue({ count: 1 });

    const response = await route.PUT(
      new Request('http://localhost/api/reminders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminders: [
            {
              id: 'rem-1',
              timing: '1 Day Overdue',
              template: 'Pay now',
              active: true,
              order: 0,
            },
          ],
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ message: 'Reminders updated' });
    expect(prismaMock.reminderTemplate.updateMany).toHaveBeenCalledWith({
      where: { id: 'rem-1', userId: 'user-1' },
      data: {
        timing: '1 Day Overdue',
        template: 'Pay now',
        providerTemplateName: null,
        active: true,
        order: 0,
      },
    });
  });

  it('creates reminders using max order + 1 per user and channel', async () => {
    const { route, authMock, prismaMock } = await loadRemindersRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.reminderTemplate.findFirst.mockResolvedValue({ order: 2 });
    prismaMock.reminderTemplate.create.mockResolvedValue({
      id: 'rem-3',
      userId: 'user-1',
      channel: 'whatsapp',
      timing: '3 Days Before Due',
      template: 'Pay now',
      order: 3,
      active: true,
    });

    const response = await route.POST(
      new Request('http://localhost/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'whatsapp',
          timing: '3 Days Before Due',
          template: 'Pay now',
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({ id: 'rem-3', order: 3 });
    expect(prismaMock.reminderTemplate.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', channel: 'whatsapp' },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    expect(prismaMock.reminderTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          channel: 'whatsapp',
          order: 3,
        }),
      })
    );
  });

  it('requires reminder id on delete and scopes deletion to the user', async () => {
    const { route, authMock, prismaMock } = await loadRemindersRoute();
    authMock.mockResolvedValue({ user: { id: 'user-1' } });
    prismaMock.reminderTemplate.deleteMany.mockResolvedValue({ count: 1 });

    const missingIdResponse = await route.DELETE(
      new Request('http://localhost/api/reminders', { method: 'DELETE' })
    );
    expect(missingIdResponse.status).toBe(400);

    const response = await route.DELETE(
      new Request('http://localhost/api/reminders?id=rem-1', { method: 'DELETE' })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ message: 'Reminder deleted' });
    expect(prismaMock.reminderTemplate.deleteMany).toHaveBeenCalledWith({
      where: { id: 'rem-1', userId: 'user-1' },
    });
  });
});
