import { describe, expect, it, vi } from 'vitest';

async function loadRegisterRoute() {
  vi.resetModules();

  const hashMock = vi.fn();
  const transactionClient = {
    user: {
      create: vi.fn(),
    },
    reminderTemplate: {
      createMany: vi.fn(),
    },
  };
  const prismaMock = {
    $transaction: vi.fn(),
  };

  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof transactionClient) => unknown) => callback(transactionClient)
  );

  vi.doMock('bcryptjs', () => ({
    default: {
      hash: hashMock,
    },
  }));
  vi.doMock('@/lib/prisma', () => ({ prisma: prismaMock }));

  const route = await import('@/app/api/auth/register/route');
  return { route, hashMock, prismaMock, transactionClient };
}

describe('POST /api/auth/register', () => {
  it('creates a user and default reminder templates', async () => {
    const { route, hashMock, prismaMock, transactionClient } = await loadRegisterRoute();
    hashMock.mockResolvedValue('hashed-password');
    transactionClient.user.create.mockResolvedValue({ id: 'user-1' });
    transactionClient.reminderTemplate.createMany.mockResolvedValue({ count: 4 });

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mina',
        email: 'MINA@example.com',
        password: 'secret123',
      }),
    });

    const response = await route.POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      message: 'User created successfully',
      userId: 'user-1',
    });

    expect(hashMock).toHaveBeenCalledWith('secret123', 12);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.user.create).toHaveBeenCalledTimes(1);
    expect(transactionClient.reminderTemplate.createMany).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate email addresses', async () => {
    const { route, prismaMock } = await loadRegisterRoute();
    prismaMock.$transaction.mockRejectedValue({ code: 'P2002' });

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mina',
        email: 'mina@example.com',
        password: 'secret123',
      }),
    });

    const response = await route.POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'Email already in use',
      code: 'CONFLICT',
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when reminder template bootstrap fails inside the transaction', async () => {
    const { route, hashMock, prismaMock, transactionClient } = await loadRegisterRoute();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    hashMock.mockResolvedValue('hashed-password');
    transactionClient.user.create.mockResolvedValue({ id: 'user-1' });
    transactionClient.reminderTemplate.createMany.mockRejectedValue(new Error('transient db failure'));

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mina',
        email: 'mina@example.com',
        password: 'secret123',
      }),
    });

    const response = await route.POST(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toMatchObject({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.user.create).toHaveBeenCalledTimes(1);
    expect(transactionClient.reminderTemplate.createMany).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  });
});
