import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/admin/login', '/api/auth/login', '/api/auth/register', '/api/payments/webhook'];

  // Check if the route is public
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Check authentication for admin routes - only check if token exists in cookie
  // Token validation will be done client-side or in API routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('token')?.value;
    console.log('[Proxy] Path:', pathname, '| Token exists:', !!token);

    if (!token) {
      console.log('[Proxy] No token, redirecting to login');
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    // Token exists, allow access
    console.log('[Proxy] Token exists, allowing access');
    return NextResponse.next();
  }

  // For API routes, just pass through - validation done in route handlers
  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};

