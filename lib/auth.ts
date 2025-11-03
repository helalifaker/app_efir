// lib/auth.ts
// Authorization helpers for checking admin access

import { User } from '@supabase/supabase-js';

/**
 * Check if user is admin
 * Checks in order:
 * 1. ADMIN_EMAILS environment variable (comma-separated list)
 * 2. user.user_metadata.role === 'admin'
 * 3. user.user_metadata.isAdmin === true
 */
export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false;
  }

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

/**
 * Get admin email list from environment
 */
export function getAdminEmails(): string[] {
  return process.env.ADMIN_EMAILS?.split(',').map((e) => e.trim()) || [];
}

