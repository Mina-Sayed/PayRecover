import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app icon asset', () => {
  it('provides an SVG icon for browser favicon usage', () => {
    const iconPath = path.resolve(process.cwd(), 'app/icon.svg');

    expect(existsSync(iconPath)).toBe(true);

    const content = readFileSync(iconPath, 'utf8');
    expect(content).toContain('<svg');
  });
});
