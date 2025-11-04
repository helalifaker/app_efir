// lib/getSettings.ts
import { getServiceClient } from './supabaseServer';
import { logger } from './logger';

export type AppSettings = {
  vat: { rate: number };
  numberFormat: { locale: 'en-US' | 'ar-SA'; decimals: 0 | 2; compact: boolean };
  validation: { requireTabs: string[]; bsTolerance: number };
  ui: { currency: string; theme: 'system' | 'light' | 'dark' };
};

export const DEFAULT_SETTINGS: AppSettings = {
  vat: { rate: 0.15 },
  numberFormat: { locale: 'en-US', decimals: 2, compact: false },
  validation: { requireTabs: ['overview', 'pnl', 'bs', 'cf'], bsTolerance: 0.01 },
  ui: { currency: 'SAR', theme: 'system' },
};

/**
 * Fetch app settings with defaults applied
 */
export async function getSettings(): Promise<AppSettings> {
  const supabase = getServiceClient();

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value');

    if (error) {
      logger.error('Settings query error', error, { operation: 'fetch_settings' });
      return DEFAULT_SETTINGS;
    }

    // Merge settings with defaults
    const settings = { ...DEFAULT_SETTINGS };
    type SettingsKey = keyof AppSettings;
    (data || []).forEach((item: { key: string; value: unknown }) => {
      if (item.key in DEFAULT_SETTINGS) {
        const key = item.key as SettingsKey;
        (settings as any)[key] = item.value;
      }
    });

    return settings;
  } catch (e) {
    logger.error('Settings fetch error', e instanceof Error ? e : new Error(String(e)), { operation: 'fetch_settings' });
    return DEFAULT_SETTINGS;
  }
}

/**
 * Get a specific setting value with default
 */
export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K]> {
  const settings = await getSettings();
  return settings[key];
}

