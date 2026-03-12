import { describe, expect, it, vi } from 'vitest';

async function loadRegisterRoute() {
  vi.resetModules();

  const hashMock = vi.fn();
  const callSupabaseRpcMock = vi.fn();
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
  vi.doMock('@/lib/supabase-rpc', () => ({ callSupabaseRpc: callSupabaseRpcMock }));

  const route = await import('@/app/api/auth/register/route');
  return { route, hashMock, prismaMock, transactionClient, callSupabaseRpcMock };
}

describe('POST /api/auth/register', () => {
  it('creates a user and default reminder templates', async () => {
    const { route, hashMock, prismaMock, transactionClient } = await loadRegisterRoute();
    hashMock.mockResolvedValue('hashed-password');
    transactionClient.user.create.mockResolvedValue({ id: 'user-1' });
    transactionClient.reminderTemplate.createMany.mockResolvedValue({ count: 2 });

    const request = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Mina',
          email: 'MINA@example.com',
          password: 'Strongpass123',
        }),
      });

    const response = await route.POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      message: 'User created successfully',
      userId: 'user-1',
    });

    expect(hashMock).toHaveBeenCalledWith('Strongpass123', 12);
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
          password: 'Strongpass123',
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
          password: 'Strongpass123',
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

  it('falls back to Supabase RPC when database connectivity fails', async () => {
    const { route, hashMock, prismaMock, callSupabaseRpcMock } = await loadRegisterRoute();
    hashMock.mockResolvedValue('hashed-password');
    prismaMock.$transaction.mockRejectedValue({
      code: 'P1001',
      message: "Can't reach database server at db.fkweqrvrmsydmhrjgagr.supabase.co",
    });
    callSupabaseRpcMock.mockResolvedValue({ userId: 'user-rpc-1' });

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mina',
        email: 'mina@example.com',
        password: 'Strongpass123',
      }),
    });

    const response = await route.POST(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      message: 'User created successfully',
      userId: 'user-rpc-1',
    });
    expect(callSupabaseRpcMock).toHaveBeenCalledWith('app_register_user', {
      p_name: 'Mina',
      p_email: 'mina@example.com',
      p_hashed_password: 'hashed-password',
      p_secret: process.env.PROVIDER_CONFIG_SECRET,
    });
  });

  it('maps duplicate email from the fallback RPC to 409', async () => {
    const { route, hashMock, prismaMock, callSupabaseRpcMock } = await loadRegisterRoute();
    hashMock.mockResolvedValue('hashed-password');
    prismaMock.$transaction.mockRejectedValue({
      code: 'P1001',
      message: "Can't reach database server at db.fkweqrvrmsydmhrjgagr.supabase.co",
    });
    callSupabaseRpcMock.mockRejectedValue(new Error('email already in use'));

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mina',
        email: 'mina@example.com',
        password: 'Strongpass123',
      }),
    });

    const response = await route.POST(request);
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'Email already in use',
      code: 'CONFLICT',
    });
  });

  it('rejects weak passwords before touching the database', async () => {
    const { route, prismaMock } = await loadRegisterRoute();

    const request = new Request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mina',
        email: 'mina@example.com',
        password: 'short',
      }),
    });

    const response = await route.POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      error: 'Password must be at least 12 characters',
      code: 'VALIDATION_ERROR',
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
