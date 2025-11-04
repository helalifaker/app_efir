// lib/type-guards.ts
// Type guards for runtime type checking

import { PostgrestError } from '@supabase/supabase-js';

/**
 * Type guard for Supabase PostgrestError
 */
export function isSupabaseError(error: unknown): error is PostgrestError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    'message' in error &&
    'details' in error &&
    'hint' in error
  );
}

/**
 * Type guard for Error objects
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

/**
 * Type guard for objects with a specific key
 */
export function hasKey<T extends string>(
  obj: unknown,
  key: T
): obj is Record<T, unknown> {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    key in obj
  );
}

/**
 * Type guard for objects with multiple keys
 */
export function hasKeys<T extends string>(
  obj: unknown,
  keys: T[]
): obj is Record<T, unknown> {
  if (obj === null || typeof obj !== 'object') {
    return false;
  }
  return keys.every(key => key in obj);
}

