// lib/resolveUser.ts
import { getServiceClient } from './supabaseServer';
import { logger } from './logger';

/**
 * Resolve a user ID to email (or name if available in profiles)
 * Returns "System" if not found or null
 */
export async function resolveUser(userId: string | null): Promise<string> {
  if (!userId) return 'System';

  try {
    const supabase = getServiceClient();

    // First try to get from auth.users via admin API
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (!userError && userData?.user?.email) {
      return userData.user.email;
    }

    // Fallback: try to get from profiles table
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', userId)
      .maybeSingle();

    if (!profileError && profile) {
      return profile.full_name || profile.email || 'System';
    }

    return 'System';
  } catch (e) {
    logger.error('Error resolving user', e instanceof Error ? e : new Error(String(e)), { userId, operation: 'resolve_user' });
    return 'System';
  }
}

/**
 * Resolve multiple user IDs to emails/names
 */
export async function resolveUsers(userIds: (string | null)[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  const resolved: Record<string, string> = {};

  await Promise.all(
    uniqueIds.map(async (id) => {
      if (id) {
        resolved[id] = await resolveUser(id);
      }
    })
  );

  return resolved;
}

