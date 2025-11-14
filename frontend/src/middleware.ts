import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Decode JWT token to extract payload (without verification)
 * We only need to read the role, verification happens on backend
 */
function decodeJWT(token: string): { role?: string; address?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf-8');
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

/**
 * Next.js Middleware for centralized authentication and route protection
 * This runs on the edge before any page renders
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get auth token from cookies
  const authToken = request.cookies.get('auth_token')?.value;

  // Debug logging for protected routes
  if (pathname.startsWith('/shop') || pathname.startsWith('/customer') || pathname.startsWith('/admin')) {
    console.log('[Middleware] Protected route access:', {
      pathname,
      hasAuthToken: !!authToken,
      authTokenPreview: authToken ? `${authToken.substring(0, 20)}...` : 'none',
      allCookies: request.cookies.getAll().map(c => c.name)
    });
  }

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/register',
    '/about',
    '/contact',
    '/choose',
    '/features',
    '/rewards',
    '/status',
    '/api/auth/register'
  ];

  // Check if the current path is public
  // Use exact match for '/' and startsWith for others to avoid matching everything
  const isPublicRoute = pathname === '/' || publicRoutes.some(route => {
    if (route === '/') return false; // Skip '/' in startsWith check
    return pathname.startsWith(route);
  });

  // Protected route patterns
  const isAdminRoute = pathname.startsWith('/admin');
  const isShopRoute = pathname.startsWith('/shop');
  const isCustomerRoute = pathname.startsWith('/customer');
  const isDashboardRoute = pathname.startsWith('/dashboard');

  const isProtectedRoute = isAdminRoute || isShopRoute || isCustomerRoute || isDashboardRoute;

  // If it's a protected route and no auth token, redirect to home page
  // ENABLED: With subdomain setup (api.repaircoin.ai + repaircoin.ai),
  // middleware CAN read cookies because they share the same domain (.repaircoin.ai)
  // This provides server-side protection before the page even loads
  if (isProtectedRoute && !authToken) {
    console.log('[Middleware] No auth token - redirecting to home:', {
      pathname,
      hasToken: !!authToken
    });

    const homeUrl = new URL('/', request.url);
    homeUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(homeUrl);
  }

  // Role-based access control
  // With subdomain setup, this works in both development and production
  // Provides server-side role validation before page render
  if (authToken && isProtectedRoute) {
    const decoded = decodeJWT(authToken);
    const userRole = decoded?.role?.toLowerCase();

    console.log('[Middleware] Role-based access check:', {
      pathname,
      userRole,
      hasRole: !!userRole
    });

    // Define role-based route mappings
    const roleRouteMap: Record<string, string[]> = {
      customer: ['/customer', '/dashboard'],
      shop: ['/shop'],
      admin: ['/admin'],
      super_admin: ['/admin'] // super_admin can access admin routes
    };

    // Check if user has access to the current route
    if (userRole && roleRouteMap[userRole]) {
      const allowedRoutes = roleRouteMap[userRole];
      const hasAccess = allowedRoutes.some(route => pathname.startsWith(route));

      if (!hasAccess) {
        console.log('[Middleware] Role mismatch - redirecting:', {
          userRole,
          attemptedPath: pathname,
          redirectTo: roleRouteMap[userRole]?.[0]
        });

        // Redirect to user's appropriate dashboard
        const redirectMap: Record<string, string> = {
          customer: '/customer',
          shop: '/shop',
          admin: '/admin',
          super_admin: '/admin'
        };

        const redirectUrl = redirectMap[userRole] || '/';
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
    }
  }

  // If user is authenticated and tries to access register, redirect to their dashboard
  if (authToken && pathname === '/register') {
    return NextResponse.redirect(new URL('/choose', request.url));
  }

  // Allow the request to continue
  return NextResponse.next();
}

/**
 * Configure which routes this middleware should run on
 * We exclude static files, images, and API routes
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
