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
