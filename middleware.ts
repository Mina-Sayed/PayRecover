import { getToken } from 'next-auth/jwt';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthRedirectPath } from '@/lib/middleware-auth';

/**
 * Enforces authentication rules for matched routes and redirects when a different auth state is required.
 *
 * @returns A NextResponse that redirects to the computed auth path when a redirect is required, or the result of NextResponse.next() to continue processing the request.
 */
export default async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.AUTH_SECRET });
  const redirectPath = getAuthRedirectPath(req.nextUrl.pathname, Boolean(token));

  if (redirectPath) {
    return NextResponse.redirect(new URL(redirectPath, req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*'],
};
