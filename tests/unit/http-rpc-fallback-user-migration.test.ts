import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  process.cwd(),
  'prisma',
  'migrations',
  '202603110007_fix_http_fallback_user_timestamps',
  'migration.sql'
);

describe('HTTP RPC fallback user profile migration', () => {
  it('sets createdAt and updatedAt when bootstrapping a user profile', () => {
    const sql = readFileSync(migrationPath, 'utf8');

    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.app_ensure_user_profile');
    expect(sql).toContain('"createdAt"');
    expect(sql).toContain('"updatedAt"');
    expect(sql).toContain('now(),');
    expect(sql).toContain('now()');
  });
});
