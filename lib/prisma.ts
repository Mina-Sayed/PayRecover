import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { getEnv, requireEnv } from '@/lib/env';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

type PoolConfigWithFamily = ConstructorParameters<typeof Pool>[0] & {
  family?: 4 | 6;
};

function getPgIpFamily(): 4 | 6 | undefined {
  const configuredFamily = getEnv('DATABASE_IP_FAMILY') || getEnv('PGIPFAMILY');
  if (!configuredFamily) {
    return 4;
  }

  if (configuredFamily === '4') {
    return 4;
  }

  if (configuredFamily === '6') {
    return 6;
  }

  throw new Error('DATABASE_IP_FAMILY must be either "4" or "6" when provided');
}

const poolConfig: PoolConfigWithFamily = {
  connectionString: requireEnv('DATABASE_URL'),
  family: getPgIpFamily(),
  keepAlive: true,
};

const pool =
  globalForPrisma.pgPool ??
  new Pool(poolConfig as ConstructorParameters<typeof Pool>[0]);

if (!globalForPrisma.pgPool) {
  globalForPrisma.pgPool = pool;
}

const adapter = new PrismaPg(pool);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
