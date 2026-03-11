import { describe, expect, it, vi } from 'vitest';

async function loadAuthConfig() {
  vi.resetModules();

  const nextAuthMock = vi.fn((config: unknown) => ({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    _config: config,
  }));
  const credentialsFactoryMock = vi.fn((options: unknown) => options);
  const adapterMock = vi.fn(() => ({}));
  const compareMock = vi.fn();
  const userFindUniqueMock = vi.fn();

  vi.doMock('next-auth', () => ({ default: nextAuthMock }));
  vi.doMock('next-auth/providers/credentials', () => ({ default: credentialsFactoryMock }));
  vi.doMock('@auth/prisma-adapter', () => ({ PrismaAdapter: adapterMock }));
  vi.doMock('bcryptjs', () => ({
    default: {
      compare: compareMock,
    },
  }));
  vi.doMock('@/lib/prisma', () => ({
    prisma: {
      user: {
        findUnique: userFindUniqueMock,
      },
    },
  }));
  vi.doMock('@/lib/env', () => ({
    requireEnv: vi.fn(() => 'test-secret'),
    validateRequiredEnvVars: vi.fn(),
  }));

  const { resetAuthRateLimitStore } = await import('@/lib/auth-rate-limit');
  resetAuthRateLimitStore();

  await import('@/lib/auth');
  const config = nextAuthMock.mock.calls[0][0] as {
    providers: Array<{ authorize: (credentials: unknown, request: Request) => Promise<unknown> }>;
  };

  return { config, compareMock, userFindUniqueMock };
}

describe('credentials authorize flow', () => {
  it('returns authenticated user for valid credentials', async () => {
    const { config, compareMock, userFindUniqueMock } = await loadAuthConfig();
    const request = new Request('http://localhost/api/auth/callback/credentials', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    });

    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'mina@example.com',
      name: 'Mina',
      image: null,
      hashedPassword: 'stored-hash',
    });
    compareMock.mockResolvedValue(true);

    const result = await config.providers[0].authorize({
      email: 'MINA@example.com',
      password: 'secret123',
    }, request);

    expect(userFindUniqueMock).toHaveBeenCalledWith({
      where: { email: 'mina@example.com' },
    });
    expect(compareMock).toHaveBeenCalledWith('secret123', 'stored-hash');
    expect(result).toMatchObject({
      id: 'user-1',
      email: 'mina@example.com',
    });
  });

  it('rejects invalid credentials', async () => {
    const { config, compareMock, userFindUniqueMock } = await loadAuthConfig();
    const request = new Request('http://localhost/api/auth/callback/credentials', {
      headers: {
        'x-forwarded-for': '203.0.113.10',
      },
    });

    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'mina@example.com',
      name: 'Mina',
      image: null,
      hashedPassword: 'stored-hash',
    });
    compareMock.mockResolvedValue(false);

    const result = await config.providers[0].authorize({
      email: 'mina@example.com',
      password: 'wrong-password',
    }, request);

    expect(result).toBeNull();
  });

  it('rate limits repeated failed attempts per email and IP', async () => {
    const { config, compareMock, userFindUniqueMock } = await loadAuthConfig();
    const request = new Request('http://localhost/api/auth/callback/credentials', {
      headers: {
        'x-forwarded-for': '203.0.113.99',
      },
    });

    userFindUniqueMock.mockResolvedValue({
      id: 'user-1',
      email: 'mina@example.com',
      name: 'Mina',
      image: null,
      hashedPassword: 'stored-hash',
    });
    compareMock.mockResolvedValue(false);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await config.providers[0].authorize({
        email: 'mina@example.com',
        password: 'wrong-password',
      }, request);
      expect(result).toBeNull();
    }

    compareMock.mockResolvedValue(true);
    const result = await config.providers[0].authorize({
      email: 'mina@example.com',
      password: 'secret123',
    }, request);

    expect(result).toBeNull();
    expect(compareMock).toHaveBeenCalledTimes(5);
  });
});
