// lib/getAdminConfig.ts
// Get admin configuration from admin_config table
// Returns AdminConfig with defaults merged

import { getServiceClient } from './supabaseServer';
import { AdminConfig } from '@/types';
import { logger } from './logger';

const DEFAULT_ADMIN_CONFIG: AdminConfig = {
  vat: { rate: 0.15 },
  fx: { baseCurrency: 'SAR', rates: {} },
  cpi: { baseYear: 2024, rates: {} },
  drivers: { 2025: {}, 2026: {}, 2027: {} },
  depreciation: { method: 'straight_line', rates: {} },
  rent_lease: { baseRent: 0, escalationRate: 0 },
  validation: { thresholds: {}, rules: [] },
  governance: { approvalRequired: true, maxVersions: 10 },
  npv: { discountRate: 0.1 },
  cashEngine: {
    maxIterations: 3,
    tolerance: 0.01,
    convergenceCheck: 'bs_cf_balance',
    depositRate: 0.05,
    overdraftRate: 0.12,
    interestClassification: 'Operating',
  },
};

/**
 * Fetch admin configuration from admin_config table
 * Merges with defaults to ensure all keys are present
 */
export async function getAdminConfig(): Promise<AdminConfig> {
  const supabase = getServiceClient();

  try {
    const { data, error } = await supabase
      .from('admin_config')
      .select('config_key, config_value')
      .order('config_key');

    if (error) {
      logger.error('Admin config query error', error, { operation: 'fetch_admin_config' });
      return DEFAULT_ADMIN_CONFIG;
    }

    // Build config object from database rows
    const config: Record<string, unknown> = {};
    (data || []).forEach((item: { config_key: string; config_value: unknown }) => {
      config[item.config_key] = item.config_value;
    });

    // Merge with defaults to ensure all keys are present
    return {
      ...DEFAULT_ADMIN_CONFIG,
      ...config,
    } as AdminConfig;
  } catch (e) {
    logger.error('Admin config fetch error', e instanceof Error ? e : new Error(String(e)), { operation: 'fetch_admin_config' });
    return DEFAULT_ADMIN_CONFIG;
  }
}

