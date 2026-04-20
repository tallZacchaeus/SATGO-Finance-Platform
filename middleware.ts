import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Edge middleware — runs before any page function.
 * Checks for the Laravel session cookie and redirects unauthenticated
 * users to /login without touching the Node.js runtime.
 *
 * This is the single auth boundary for all dashboard routes.
 * Individual pages no longer need their own session → redirect checks.
 */
export function middleware(request: NextRequest) {
  // APP_NAME="NYAYA Finance" → cookie name is "nyaya-finance-session"
  const session = request.cookies.get('nyaya-finance-session');

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the intended destination so login can redirect back
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/finance/:path*',
    '/requester/:path*',
    '/team-lead/:path*',
    '/notifications/:path*',
    '/settings/:path*',
  ],
};
