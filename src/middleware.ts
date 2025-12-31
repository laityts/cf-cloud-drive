import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export const runtime = 'experimental-edge';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // 1. Handle API Authentication (Skip i18n for API)
  if (path.startsWith('/api')) {
    // Allow public API paths
    if (path.startsWith('/api/auth')) {
      return NextResponse.next();
    }

    // Protect other API paths
    const token = request.cookies.get('auth_token')?.value;
    if (!token || !(await verifyJWT(token))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // 2. Handle Raw File Access (Skip i18n)
  if (path.startsWith('/raw')) {
     return NextResponse.next();
  }

  // 3. Handle Public Assets (Skip i18n)
  if (
    path.startsWith('/_next') || 
    path === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  // 4. Handle Page Authentication & i18n
  // We need to check auth BEFORE i18n middleware redirects, 
  // but i18n middleware handles the locale prefix (e.g. /en/dashboard).
  
  // Check if the user is authenticated
  const token = request.cookies.get('auth_token')?.value;
  const isAuthenticated = token && (await verifyJWT(token));

  // If not authenticated and not on login page, redirect to login
  // Note: We need to handle localized login paths (e.g. /en/login, /zh-CN/login)
  
  // Let next-intl handle the routing first to parse the locale
  const response = intlMiddleware(request);

  // If next-intl redirected (e.g. to add locale prefix), return that response
  if (response.status === 307 || response.status === 308) {
    return response;
  }

  // Extract locale from path to check if it's a login page
  // Path format: /:locale/login or /login
  const isLoginPage = path.includes('/login');

  if (!isAuthenticated && !isLoginPage) {
    // Redirect to login (preserving locale if present)
    const { locales } = routing;
    const pathLocale = locales.find(l => path.startsWith(`/${l}/`) || path === `/${l}`);
    const loginPath = pathLocale ? `/${pathLocale}/login` : '/login';
    
    return NextResponse.redirect(new URL(loginPath, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    // Match all pathnames except for
    // - /api (handled manually above, but we want to match it to run middleware)
    // - /_next
    // - /_vercel
    // - /favicon.ico
    // - /raw (handled manually)
    '/((?!_next|_vercel|favicon.ico|raw).*)',
  ],
};
