import { describe, expect, it } from 'vitest';
import { getAuthRedirectPath } from '@/lib/middleware-auth';

describe('getAuthRedirectPath', () => {
  it('redirects unauthenticated users from dashboard routes to sign in', () => {
    expect(getAuthRedirectPath('/dashboard', false)).toBe('/auth/signin');
    expect(getAuthRedirectPath('/dashboard/invoices', false)).toBe('/auth/signin');
  });

  it('redirects authenticated users away from auth routes to dashboard', () => {
    expect(getAuthRedirectPath('/auth/signin', true)).toBe('/dashboard');
    expect(getAuthRedirectPath('/auth/signup', true)).toBe('/dashboard');
  });

  it('does not redirect public paths', () => {
    expect(getAuthRedirectPath('/', false)).toBeNull();
    expect(getAuthRedirectPath('/pricing', true)).toBeNull();
  });
});
