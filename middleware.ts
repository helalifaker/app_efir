// middleware.ts
import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';

// Validate environment variables at module load (edge runtime compatible)
// This will fail fast if required env vars are missing
try {
  // Only validate what we can check in edge runtime
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    // In edge runtime, we can't use our validation function, so check manually
    console.error('Missing required Supabase environment variables');
  }
} catch (error) {
  console.error('Environment validation error:', error);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin routes
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Check environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Note: Logger not available in middleware (edge runtime)
    // Redirect to login with error message
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'config');
    return NextResponse.redirect(loginUrl);
  }

  // Create Supabase client for auth check
  // In middleware, we need to handle cookies differently
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          // Set cookie on response
          const cookieOptions: any = { name, value };
          if (options) {
            if (options.path !== undefined) cookieOptions.path = options.path;
            if (options.maxAge !== undefined) cookieOptions.maxAge = options.maxAge;
            if (options.httpOnly !== undefined) cookieOptions.httpOnly = options.httpOnly;
            if (options.secure !== undefined) cookieOptions.secure = options.secure;
            if (options.sameSite !== undefined) {
              cookieOptions.sameSite = typeof options.sameSite === 'string' 
                ? options.sameSite 
                : (options.sameSite ? 'lax' : 'none');
            }
          }
          response.cookies.set(cookieOptions);
        },
        remove(name: string, options?: any) {
          // Remove cookie on response by setting maxAge to 0
          response.cookies.set({ name, value: '', maxAge: 0, ...(options || {}) });
        },
      } as any,
    } as any
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
 * Validates email format
 * Basic email validation regex (RFC 5322 simplified)
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Parse and validate admin emails from environment variable
 * Returns array of valid emails (case-insensitive)
 * Note: In middleware (edge runtime), we can't use logger, so we silently filter invalid emails
 */
function parseAdminEmails(): string[] {
  const envValue = process.env.ADMIN_EMAILS;
  if (!envValue) {
    return [];
  }

  return envValue
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && isValidEmail(e))
    .map((e) => e.toLowerCase());
}

/**
 * Cached admin emails set for O(1) lookup performance
 * Initialized once at module load with validation
 */
const ADMIN_EMAILS_SET = (() => {
  const validEmails = parseAdminEmails();
  return new Set(validEmails);
})();

/**
 * Check if user is admin
 * Uses the same logic as lib/auth.ts
 */
function checkIsAdmin(user: User): boolean {
  // Check env list (cached Set for O(1) lookup)
  if (user.email && ADMIN_EMAILS_SET.has(user.email.toLowerCase())) {
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

