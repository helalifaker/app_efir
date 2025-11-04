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
 * Resolve multiple user IDs to emails/names (OPTIMIZED - batches queries)
 * This eliminates N+1 query problem by fetching all users in parallel batches
 */
export async function resolveUsers(userIds: (string | null)[]): Promise<Record<string, string>> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))] as string[];
  
  if (uniqueIds.length === 0) {
    return {};
  }

  const resolved: Record<string, string> = {};
  const supabase = getServiceClient();

  try {
    // Batch fetch from profiles table first (faster, single query)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', uniqueIds);

    if (!profilesError && profiles) {
      profiles.forEach((profile) => {
        resolved[profile.id] = profile.full_name || profile.email || 'System';
      });
    }

    // For any IDs not found in profiles, try auth.admin API in parallel
    const missingIds = uniqueIds.filter((id) => !resolved[id]);
    
    if (missingIds.length > 0) {
      // Fetch remaining users via admin API in parallel (batched)
      await Promise.all(
        missingIds.map(async (id) => {
          try {
            const { data: userData, error: userError } = await supabase.auth.admin.getUserById(id);
            if (!userError && userData?.user?.email) {
              resolved[id] = userData.user.email;
            } else {
              resolved[id] = 'System';
            }
          } catch (e) {
            logger.debug('Error fetching user via admin API', { userId: id, error: e });
            resolved[id] = 'System';
          }
        })
      );
    }

    // Ensure all IDs have a value (fallback to 'System')
    uniqueIds.forEach((id) => {
      if (!resolved[id]) {
        resolved[id] = 'System';
      }
    });

    return resolved;
  } catch (e) {
    logger.error('Error resolving users', e instanceof Error ? e : new Error(String(e)), { 
      userIds: uniqueIds, 
      operation: 'resolve_users' 
    });
    
    // Fallback: return System for all
    uniqueIds.forEach((id) => {
      resolved[id] = 'System';
    });
    
    return resolved;
  }
}

