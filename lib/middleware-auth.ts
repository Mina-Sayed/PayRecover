/**
 * Determine an authentication-related redirect path based on the current pathname and login state.
 *
 * @param pathname - The current request pathname (e.g., "/dashboard", "/auth/signin")
 * @param isLoggedIn - Whether the user is currently authenticated
 * @returns A redirect path (`'/auth/signin'` or `'/dashboard'`) when a redirect is needed, or `null` when no redirect is required
 */
export function getAuthRedirectPath(pathname: string, isLoggedIn: boolean): string | null {
  const isOnDashboard = pathname.startsWith('/dashboard');
  const isOnAuth = pathname.startsWith('/auth');

  if (isOnDashboard && !isLoggedIn) {
    return '/auth/signin';
  }

  if (isOnAuth && isLoggedIn) {
    return '/dashboard';
  }

  return null;
}
