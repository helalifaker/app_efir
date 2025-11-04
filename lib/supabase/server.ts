// synced for vercel
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment variables.'
    );
  }

  // Validate URL format
  if (!supabaseUrl.startsWith('https://')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL'
    );
  }

  // Next.js 16: cookies() is async
  const cookieStore = await cookies(); // next16

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: any) {
          // Build cookie options object
          const cookieOptions: any = { name, value };
          if (options) {
            if (options.path !== undefined) cookieOptions.path = options.path;
            if (options.maxAge !== undefined) cookieOptions.maxAge = options.maxAge;
            if (options.httpOnly !== undefined) cookieOptions.httpOnly = options.httpOnly;
            if (options.secure !== undefined) cookieOptions.secure = options.secure;
            if (options.sameSite !== undefined) {
              // Ensure sameSite is a string, not boolean
              cookieOptions.sameSite = typeof options.sameSite === 'string' 
                ? options.sameSite 
                : (options.sameSite ? 'lax' : 'none');
            }
          }
          cookieStore.set(cookieOptions);
        },
        remove(name: string, options?: any) {
          cookieStore.set({ name, value: '', maxAge: 0, ...(options || {}) });
        },
      } as any,
    } as any
  );
}
