// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client using your environment variables
export function getServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase environment variables. ' +
      'Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables.'
    );
  }

  // Validate URL format
  if (!supabaseUrl.startsWith('https://')) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid HTTPS URL'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
