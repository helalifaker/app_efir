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
 * Type-safe merge of settings with defaults
 */
export function mergeSettings(defaults: AppSettings, fetched: Array<{ key: string; value: unknown }>): AppSettings {
  const settings: AppSettings = { ...defaults };

  fetched.forEach((item) => {
    const key = item.key as keyof AppSettings;
    if (!(key in defaults)) {
      return;
    }
    
    const defaultValue = defaults[key];
    const fetchedValue = item.value;

    // Use type-specific handling to satisfy TypeScript
    switch (key) {
      case 'vat':
        if (
          typeof fetchedValue === 'object' &&
          fetchedValue !== null &&
          'rate' in fetchedValue &&
          typeof (fetchedValue as { rate: unknown }).rate === 'number'
        ) {
          settings.vat = { ...defaultValue, ...(fetchedValue as AppSettings['vat']) };
        }
        break;
      case 'numberFormat':
        if (
          typeof fetchedValue === 'object' &&
          fetchedValue !== null &&
          'locale' in fetchedValue &&
          'decimals' in fetchedValue &&
          'compact' in fetchedValue
        ) {
          settings.numberFormat = { ...defaultValue, ...(fetchedValue as AppSettings['numberFormat']) };
        }
        break;
      case 'validation':
        if (
          typeof fetchedValue === 'object' &&
          fetchedValue !== null &&
          'requireTabs' in fetchedValue &&
          'bsTolerance' in fetchedValue
        ) {
          settings.validation = { ...defaultValue, ...(fetchedValue as AppSettings['validation']) };
        }
        break;
      case 'ui':
        if (
          typeof fetchedValue === 'object' &&
          fetchedValue !== null &&
          'currency' in fetchedValue &&
          'theme' in fetchedValue
        ) {
          settings.ui = { ...defaultValue, ...(fetchedValue as AppSettings['ui']) };
        }
        break;
    }
  });

  return settings;
}

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

    return mergeSettings(DEFAULT_SETTINGS, data || []);
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

