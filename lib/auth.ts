// lib/auth.ts
// Authorization helpers for checking admin access

import { User } from '@supabase/supabase-js';
import { logger } from './logger';

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
 * Returns array of valid emails, logs warnings for invalid entries
 */
function parseAdminEmails(): string[] {
  const envValue = process.env.ADMIN_EMAILS;
  if (!envValue) {
    return [];
  }

  const emails = envValue
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const validEmails: string[] = [];
  const invalidEmails: string[] = [];

  for (const email of emails) {
    if (isValidEmail(email)) {
      validEmails.push(email.toLowerCase());
    } else {
      invalidEmails.push(email);
    }
  }

  if (invalidEmails.length > 0) {
    logger.warn('Invalid admin emails found in ADMIN_EMAILS', {
      invalid: invalidEmails,
      valid: validEmails,
      note: 'Invalid emails will be ignored',
    });
  }

  if (validEmails.length === 0 && emails.length > 0) {
    logger.warn('No valid admin emails found in ADMIN_EMAILS', {
      raw: emails,
      note: 'Admin access will only work via user_metadata',
    });
  }

  return validEmails;
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
 * Checks in order:
 * 1. ADMIN_EMAILS environment variable (comma-separated list) - cached in Set for performance
 * 2. user.user_metadata.role === 'admin'
 * 3. user.user_metadata.isAdmin === true
 */
export function isAdmin(user: User | null): boolean {
  if (!user) {
    return false;
  }

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

/**
 * Get admin email list from environment
 * Returns validated emails only (case-preserved)
 */
export function getAdminEmails(): string[] {
  return parseAdminEmails();
}

