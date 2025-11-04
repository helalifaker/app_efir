// lib/ownership.ts
// Helper functions for verifying user ownership of resources

import { getServiceClient } from './supabaseServer';
import { createErrorResponse } from './withErrorHandler';
import { logger } from './logger';
import { NextResponse } from 'next/server';

interface VersionWithModel {
  id: string;
  model_id: string;
  model: {
    id: string;
    owner_id: string | null;
  } | {
    id: string;
    owner_id: string | null;
  }[];
}

/**
 * Verify that a user owns a version (via model ownership)
 * Returns the version data if ownership is verified, or null if not found/not owned
 */
export async function verifyVersionOwnership(
  versionId: string,
  userId: string | null
): Promise<{ owned: boolean; version?: VersionWithModel; error?: NextResponse }> {
  if (!userId) {
    return {
      owned: false,
      error: createErrorResponse('Authentication required', 401),
    };
  }

  const supabase = getServiceClient();

  // Get version with model ownership info
  const { data: version, error } = await supabase
    .from('model_versions')
    .select(`
      id,
      model_id,
      model:models!inner(
        id,
        owner_id
      )
    `)
    .eq('id', versionId)
    .single();

  if (error || !version) {
    logger.warn('Version not found for ownership check', { versionId, userId, error });
    return {
      owned: false,
      error: createErrorResponse(
        'Version not found. It may have been deleted or you may not have permission to view it.',
        404
      ),
    };
  }

  // Check ownership
  // Type assertion: Supabase returns joined relations as arrays in types, but !inner with .single() returns a single object
  const model = Array.isArray(version.model) ? version.model[0] : version.model;
  if (!model.owner_id) {
    // NULL owner models security policy:
    // - In production: STRICTLY DISALLOWED unless explicitly enabled
    // - In development: Allowed with warning logging
    // - ALLOW_NULL_OWNERS env var controls behavior (default: false in production)
    //
    // Security Note: NULL owner models bypass ownership checks and are accessible
    // by all authenticated users. This is a security risk and should be avoided
    // in production unless absolutely necessary for shared resources.
    const isProduction = process.env.NODE_ENV === 'production';
    const allowNullOwners = process.env.ALLOW_NULL_OWNERS === 'true';
    
    // In production, fail hard if NULL owners not explicitly allowed
    if (isProduction && !allowNullOwners) {
      logger.error('SECURITY: NULL owner model access denied in production', {
        versionId,
        userId,
        modelId: model.id,
        reason: 'ALLOW_NULL_OWNERS not set to true',
      });
      return {
        owned: false,
        error: createErrorResponse(
          'Forbidden: This resource requires ownership. NULL owner models are not allowed in production.',
          403
        ),
      };
    }
    
    // In development, warn but allow (for testing)
    if (!isProduction) {
      logger.warn('NULL owner model accessed in development', {
        versionId,
        userId,
        modelId: model.id,
        note: 'This should not happen in production',
      });
    } else {
      // Production with explicit allow - log for audit
      logger.warn('NULL owner model accessed in production (ALLOW_NULL_OWNERS=true)', {
        versionId,
        userId,
        modelId: model.id,
        severity: 'HIGH',
      });
    }
    
    // Type assertion for return value
    const versionResult: VersionWithModel = {
      ...version,
      model: Array.isArray(version.model) ? version.model[0] : version.model,
    };
    return { owned: true, version: versionResult };
  }

  if (model.owner_id !== userId) {
    logger.warn('User does not own version', { versionId, userId, ownerId: model.owner_id });
    return {
      owned: false,
      error: createErrorResponse(
        'Access denied. You do not have permission to access this version. Please contact the owner if you need access.',
        403
      ),
    };
  }

  // Type assertion for return value
  const versionResult: VersionWithModel = {
    ...version,
    model: Array.isArray(version.model) ? version.model[0] : version.model,
  };
  return { owned: true, version: versionResult };
  }

interface Model {
  id: string;
  owner_id: string | null;
}

/**
 * Verify that a user owns a model
 */
export async function verifyModelOwnership(
  modelId: string,
  userId: string | null
): Promise<{ owned: boolean; model?: Model; error?: NextResponse }> {
  if (!userId) {
    return {
      owned: false,
      error: createErrorResponse('Authentication required', 401),
    };
  }

  const supabase = getServiceClient();

  const { data: model, error } = await supabase
    .from('models')
    .select('id, owner_id')
    .eq('id', modelId)
    .single();

  if (error || !model) {
    logger.warn('Model not found for ownership check', { modelId, userId, error });
    return {
      owned: false,
      error: createErrorResponse(
        'Model not found. It may have been deleted or you may not have permission to view it.',
        404
      ),
    };
  }

  // Check ownership
  if (!model.owner_id) {
    // NULL owner models security policy:
    // - In production: STRICTLY DISALLOWED unless explicitly enabled
    // - In development: Allowed with warning logging
    // - ALLOW_NULL_OWNERS env var controls behavior (default: false in production)
    //
    // See verifyVersionOwnership for detailed documentation
    const isProduction = process.env.NODE_ENV === 'production';
    const allowNullOwners = process.env.ALLOW_NULL_OWNERS === 'true';
    
    // In production, fail hard if NULL owners not explicitly allowed
    if (isProduction && !allowNullOwners) {
      logger.error('SECURITY: NULL owner model access denied in production', {
        modelId,
        userId,
        reason: 'ALLOW_NULL_OWNERS not set to true',
      });
      return {
        owned: false,
        error: createErrorResponse(
          'Forbidden: This resource requires ownership. NULL owner models are not allowed in production.',
          403
        ),
      };
    }
    
    // In development, warn but allow (for testing)
    if (!isProduction) {
      logger.warn('NULL owner model accessed in development', {
        modelId,
        userId,
        note: 'This should not happen in production',
      });
    } else {
      // Production with explicit allow - log for audit
      logger.warn('NULL owner model accessed in production (ALLOW_NULL_OWNERS=true)', {
        modelId,
        userId,
        severity: 'HIGH',
      });
    }
    
    return { owned: true, model };
  }

  if (model.owner_id !== userId) {
    logger.warn('User does not own model', { modelId, userId, ownerId: model.owner_id });
    return {
      owned: false,
      error: createErrorResponse(
        'Access denied. You do not have permission to access this model. Please contact the owner if you need access.',
        403
      ),
    };
  }

  return { owned: true, model };
}

/**
 * Get current user ID from request context
 * Returns null if no user is authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { createClient } = await import('./supabase/server');
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
  } catch {
    return null;
  }
}

