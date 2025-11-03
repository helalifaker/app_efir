// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js';

// Create a Supabase client using your environment variables
export function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // server-side only key
  );
}
