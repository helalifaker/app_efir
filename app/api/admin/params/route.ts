// app/api/admin/params/route.ts
// Admin configuration API - uses admin_config table (time-series config)
// GET: Returns all admin configuration
// PATCH: Updates admin configuration with versioning and audit trail

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceClient } from '@/lib/supabaseServer';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { PartialAdminConfigSchema } from '@/lib/schemas/timeseries';
import { runCashEngineForVersion } from '@/lib/engine/cashEngineService';
import type { AdminConfig } from '@/types';

/**
 * GET /api/admin/params
 * Returns all admin configuration from admin_config table
 */
export const GET = withErrorHandler(async () => {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('admin_config')
    .select('config_key, config_value')
    .order('config_key');

  if (error) {
    logger.error('Admin config GET error', error, { operation: 'fetch_admin_config' });
    return createErrorResponse('Failed to fetch admin configuration', 500);
  }

  // Build config object from database rows
  const config: Partial<AdminConfig> = {};
  (data || []).forEach((item: { config_key: string; config_value: unknown }) => {
    const key = item.config_key as keyof AdminConfig;
    (config as any)[key] = item.config_value;
  });

  // Merge with defaults to ensure all keys are present
  const defaults: AdminConfig = {
    vat: { rate: 0.15 },
    fx: { baseCurrency: 'SAR', rates: {} },
    cpi: { baseYear: 2024, rates: {} },
    drivers: { 2025: {}, 2026: {}, 2027: {} },
    depreciation: { method: 'straight_line', rates: {} },
    rent_lease: { baseRent: 0, escalationRate: 0 },
    validation: { thresholds: {}, rules: [] },
    governance: { approvalRequired: true, maxVersions: 10 },
    npv: { discountRate: 0.1 },
    cashEngine: { maxIterations: 3, tolerance: 0.01, convergenceCheck: 'bs_cf_balance' },
  };

  const mergedConfig = { ...defaults, ...config };

  logger.info('Admin config fetched successfully', { keys: Object.keys(mergedConfig) });
  return NextResponse.json(mergedConfig);
});

/**
 * PATCH /api/admin/params
 * Updates admin configuration with versioning and audit trail
 * 
 * Body: Partial<AdminConfig> - only send keys you want to update
 * Requires: Admin authorization
 */
export const PATCH = withErrorHandler(async (req: NextRequest) => {
  // Check authentication and admin authorization
  const serverSupabase = await createServerClient();
  const { data: { user }, error: authError } = await serverSupabase.auth.getUser();

  if (authError || !user) {
    logger.warn('Admin config update attempted without authentication', { error: authError });
    return createErrorResponse('Authentication required', 401);
  }

  if (!isAdmin(user)) {
    logger.warn('Admin config update attempted by non-admin user', { userId: user.id, email: user.email });
    return createErrorResponse('Admin access required', 403);
  }

  const body = await req.json();

  // Validate the request body
  let validated;
  try {
    validated = PartialAdminConfigSchema.parse(body);
  } catch (e) {
    if (e instanceof z.ZodError) {
      logger.warn('Admin config validation error', { errors: e.issues });
      return createErrorResponse('Invalid request', 400, e.issues);
    }
    throw e;
  }

  const supabase = getServiceClient();

  // Get current user ID for audit trail
  const updatedBy = user.id;

  // Update each config key
  const updates = Object.entries(validated).map(async ([configKey, configValue]) => {
    // Fetch current value for versioning
    const { data: current } = await supabase
      .from('admin_config')
      .select('config_value, version')
      .eq('config_key', configKey)
      .single();

    const previousVersion = current?.config_value || null;
    const nextVersion = (current?.version || 0) + 1;

    // Upsert with versioning
    const { error } = await supabase
      .from('admin_config')
      .upsert(
        {
          config_key: configKey,
          config_value: configValue as AdminConfig[keyof AdminConfig],
          version: nextVersion,
          previous_version: previousVersion,
          updated_by: updatedBy,
          updated_at: new Date().toISOString(),
          change_note: `Updated via API by ${user.email || user.id}`,
        },
        { onConflict: 'config_key' }
      );

    if (error) {
      logger.error(`Admin config update error for key ${configKey}`, error, { configKey });
      throw error;
    }

    logger.info(`Admin config updated: ${configKey}`, { version: nextVersion });
  });

  await Promise.all(updates);

  logger.info('Admin config updated successfully', { keys: Object.keys(validated) });

  // Auto-trigger cash engine for all Draft/Ready versions if cashEngine config changed
  // This ensures financial statements stay reconciled when engine settings change
  if (validated.cashEngine) {
    const { data: versions } = await supabase
      .from('model_versions')
      .select('id')
      .in('status', ['Draft', 'Ready']);

    if (versions && versions.length > 0) {
      logger.info('Auto-triggering cash engine for versions after admin config update', {
        versionCount: versions.length,
      });

      // Trigger cash engine for all affected versions (async, non-blocking)
      // Fire and forget pattern - errors are logged but don't block the response
      const cashEnginePromises = versions.map((v: { id: string }) =>
        runCashEngineForVersion(v.id, { forceRecalculation: true })
          .catch((error) => {
            logger.error('Auto-triggered cash engine failed', error, { versionId: v.id });
            // Return null to prevent unhandled rejection
            return null;
          })
      );

      // Log batch completion but don't await (non-blocking)
      Promise.all(cashEnginePromises)
        .then(() => {
          logger.info('Batch cash engine triggers completed', { count: versions.length });
        })
        .catch((error) => {
          logger.error('Batch cash engine trigger failed', error, { versionCount: versions.length });
        });
    }
  }

  return NextResponse.json({ ok: true, updated: Object.keys(validated) });
});
