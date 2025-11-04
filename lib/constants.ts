// lib/constants.ts
// Application-wide constants

/**
 * Pagination constants
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

/**
 * API response constants
 */
export const DEFAULT_LIMIT = 50;
export const DEFAULT_OFFSET = 0;

/**
 * Cache revalidation tags
 */
export const CACHE_TAGS = {
  VERSIONS: 'versions',
  VERSION_TABS: 'version-tabs',
  VERSION_VALIDATIONS: 'version-validations',
  VERSION_HISTORY: 'version-history',
  VERSION_METRICS: 'version-metrics',
  MODELS: 'models',
  ADMIN_CONFIG: 'admin-config',
  SETTINGS: 'settings',
} as const;

/**
 * Version status values (Blueprint: capitalized)
 */
export const VERSION_STATUS = {
  DRAFT: 'Draft',
  READY: 'Ready',
  LOCKED: 'Locked',
  ARCHIVED: 'Archived',
} as const;

/**
 * Validation severity levels
 */
export const VALIDATION_SEVERITY = {
  CRITICAL: 'critical',
  ERROR: 'error',
  MAJOR: 'major',
  WARNING: 'warning',
  MINOR: 'minor',
} as const;

/**
 * Error codes for standardized error responses
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
} as const;

