// lib/getSettings.ts
import { getServiceClient } from './supabaseServer';

export type AppSettings = {
  vat: { rate: number };
  numberFormat: { locale: 'en-US' | 'ar-SA'; decimals: 0 | 2; compact: boolean };
  validation: { requireTabs: string[]; bsTolerance: number };
  ui: { currency: string; theme: 'system' | 'light' | 'dark' };
};

const DEFAULT_SETTINGS: AppSettings = {
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
      console.error('Settings query error:', error);
      return DEFAULT_SETTINGS;
    }

    // Merge settings with defaults
    const settings = { ...DEFAULT_SETTINGS };
    (data || []).forEach((item: any) => {
      if (item.key in DEFAULT_SETTINGS) {
        settings[item.key as keyof AppSettings] = item.value as any;
      }
    });

    return settings;
  } catch (e) {
    console.error('Settings fetch error:', e);
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

