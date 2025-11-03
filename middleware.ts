// middleware.ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Create Supabase client for auth check
  // In middleware, we need to handle cookies differently
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          // Set cookie on response
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          // Remove cookie on response
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Check authentication
  const { data: { user }, error } = await supabase.auth.getUser();

  // Not authenticated → redirect to login
  if (!user || error) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Check if user is admin
  const isAdmin = checkIsAdmin(user);

  // Authenticated but not admin → redirect to 403
  if (!isAdmin) {
    return NextResponse.redirect(new URL('/forbidden', request.url));
  }

  // Admin user → allow access (return response with cookies)
  return response;
}

/**
 * Check if user is admin
 * Uses the same logic as lib/auth.ts
 */
function checkIsAdmin(user: any): boolean {
  // Check env list (comma-separated emails)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) || [];
  if (user.email && adminEmails.includes(user.email.toLowerCase())) {
    return true;
  }

  // Check user_metadata.role
  if (user.user_metadata?.role === 'admin') {
    return true;
  }

  // Check user_metadata.isAdmin
  if (user.user_metadata?.isAdmin === true) {
    return true;
  }

  return false;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

