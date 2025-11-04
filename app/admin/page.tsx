'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { logger } from '@/lib/logger';

type Settings = {
  vat: { rate: number };
  numberFormat: { locale: 'en-US' | 'ar-SA'; decimals: 0 | 2; compact: boolean };
  validation: { requireTabs: string[]; bsTolerance: number };
  ui: { currency: string; theme: 'system' | 'light' | 'dark' };
  // New time-series config (from admin_config)
  fx?: { baseCurrency: string; rates: Record<string, number> };
  cpi?: { baseYear: number; rates: Record<string, number> };
  drivers?: { 2025?: Record<string, unknown>; 2026?: Record<string, unknown>; 2027?: Record<string, unknown> };
  depreciation?: { method: string; rates: Record<string, number> };
  rent_lease?: { baseRent: number; escalationRate: number };
  governance?: { approvalRequired: boolean; maxVersions: number };
  npv?: { discountRate: number };
  cashEngine?: { maxIterations: number; tolerance: number; convergenceCheck: 'bs_cf_balance' | 'cash_balance' };
};

const DEFAULT_SETTINGS: Settings = {
  vat: { rate: 0.15 },
  numberFormat: { locale: 'en-US', decimals: 2, compact: false },
  validation: { requireTabs: ['overview', 'pnl', 'bs', 'cf'], bsTolerance: 0.01 },
  ui: { currency: 'SAR', theme: 'system' },
};

export default function AdminPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Partial<Settings>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      // Load legacy settings
      const legacyRes = await fetch('/api/settings');
      const legacyData = legacyRes.ok ? await legacyRes.json() : {};
      
      // Load new admin config
      const adminRes = await fetch('/api/admin/params');
      const adminData = adminRes.ok ? await adminRes.json() : {};
      
      // Merge settings with defaults (admin config takes precedence)
      const merged = {
        ...DEFAULT_SETTINGS,
        ...legacyData,
        ...adminData,
      } as Settings;
      setSettings(merged);
    } catch (e) {
      logger.error('Failed to load admin settings', e);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  function updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
    setChanges((prev) => ({ ...prev, [key]: value }));
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    if (Object.keys(changes).length === 0) {
      toast.error('No changes to save');
      return;
    }

    try {
      setSaving(true);
      
      // Separate legacy settings from new admin config
      const legacyKeys = ['vat', 'numberFormat', 'validation', 'ui'] as const;
      const legacyChanges: Partial<Settings> = {};
      const adminChanges: Partial<Settings> = {};
      
      for (const key in changes) {
        if (changes.hasOwnProperty(key)) {
          const typedKey = key as keyof Settings;
          const value = changes[typedKey];
          if (value !== undefined) {
            if (legacyKeys.includes(typedKey as any) && typedKey in DEFAULT_SETTINGS) {
              (legacyChanges as any)[typedKey] = value;
            } else {
              (adminChanges as any)[typedKey] = value;
            }
          }
        }
      }
      
      // Save to both APIs
      const promises = [];
      if (Object.keys(legacyChanges).length > 0) {
        promises.push(
          fetch('/api/settings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(legacyChanges),
          })
        );
      }
      if (Object.keys(adminChanges).length > 0) {
        promises.push(
          fetch('/api/admin/params', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(adminChanges),
          })
        );
      }
      
      const results = await Promise.all(promises);
      const errors = results.filter((r) => !r.ok);
      
      if (errors.length > 0) {
        const error = await errors[0].json();
        throw new Error(error.error || 'Failed to save');
      }

      setChanges({});
      toast.success('Settings saved successfully');
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Failed to save settings';
      logger.error('Failed to save admin settings', e, { changes: Object.keys(changes) });
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  function resetSection<K extends keyof Settings>(key: K) {
    updateSetting(key, DEFAULT_SETTINGS[key]);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-12">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">Admin Settings</h1>
            <p className="text-slate-600 dark:text-slate-400">Manage application parameters and configuration</p>
          </div>
          {Object.keys(changes).length > 0 && (
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-sm hover:shadow-md hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>💾</span>
                  <span>Save Changes</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* VAT Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs">
                %
              </span>
              VAT Settings
            </h2>
            <button
              onClick={() => resetSection('vat')}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Reset to default
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">VAT Rate</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={settings.vat.rate}
              onChange={(e) => updateSetting('vat', { rate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter as decimal (0.15 = 15%)
            </p>
          </div>
        </section>

        {/* Number Format Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs">
                #
              </span>
              Number Format
            </h2>
            <button
              onClick={() => resetSection('numberFormat')}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Reset to default
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Locale</label>
              <select
                value={settings.numberFormat.locale}
                onChange={(e) =>
                  updateSetting('numberFormat', {
                    ...settings.numberFormat,
                    locale: e.target.value as 'en-US' | 'ar-SA',
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
              <option value="en-US">English (US)</option>
              <option value="ar-SA">Arabic (SA)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Decimal Places</label>
            <select
              value={settings.numberFormat.decimals}
              onChange={(e) =>
                updateSetting('numberFormat', {
                  ...settings.numberFormat,
                  decimals: parseInt(e.target.value) as 0 | 2,
                })
              }
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
            >
              <option value="0">0</option>
              <option value="2">2</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="compact"
            checked={settings.numberFormat.compact}
            onChange={(e) =>
              updateSetting('numberFormat', {
                ...settings.numberFormat,
                compact: e.target.checked,
              })
            }
            className="w-4 h-4"
          />
          <label htmlFor="compact" className="text-sm text-slate-700 dark:text-slate-300">
            Use compact notation (e.g., 1.2K, 1.5M)
          </label>
        </div>
      </section>

        {/* Validation Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center text-white text-xs">
                ✓
              </span>
              Validation Rules
            </h2>
            <button
              onClick={() => resetSection('validation')}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Reset to default
            </button>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Required Tabs</label>
            <input
              type="text"
              value={settings.validation.requireTabs.join(', ')}
              onChange={(e) =>
                updateSetting('validation', {
                  ...settings.validation,
                  requireTabs: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              placeholder="overview, pnl, bs, cf"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Comma-separated list</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Balance Sheet Tolerance</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={settings.validation.bsTolerance}
              onChange={(e) =>
                updateSetting('validation', {
                  ...settings.validation,
                  bsTolerance: parseFloat(e.target.value) || 0,
                })
              }
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Maximum difference allowed (default: 0.01)
            </p>
          </div>
        </section>

        {/* UI Settings */}
        <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white text-xs">
                🎨
              </span>
              UI Settings
            </h2>
            <button
              onClick={() => resetSection('ui')}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              Reset to default
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Currency</label>
              <input
                type="text"
                value={settings.ui.currency}
                onChange={(e) =>
                  updateSetting('ui', { ...settings.ui, currency: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                placeholder="SAR"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Theme</label>
              <select
                value={settings.ui.theme}
                onChange={(e) =>
                  updateSetting('ui', {
                    ...settings.ui,
                    theme: e.target.value as 'system' | 'light' | 'dark',
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </section>

        {/* Cash Engine Config */}
        {settings.cashEngine && (
          <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-xs">
                  ⚙️
                </span>
                Cash Engine Configuration
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Max Iterations</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={settings.cashEngine.maxIterations || 3}
                  onChange={(e) =>
                    updateSetting('cashEngine', {
                      ...settings.cashEngine!,
                      maxIterations: parseInt(e.target.value) || 3,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Tolerance</label>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={settings.cashEngine.tolerance || 0.01}
                  onChange={(e) =>
                    updateSetting('cashEngine', {
                      ...settings.cashEngine!,
                      tolerance: parseFloat(e.target.value) || 0.01,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Convergence Check</label>
                <select
                  value={settings.cashEngine.convergenceCheck || 'bs_cf_balance'}
                  onChange={(e) =>
                    updateSetting('cashEngine', {
                      ...settings.cashEngine!,
                      convergenceCheck: e.target.value as 'bs_cf_balance' | 'cash_balance',
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                >
                  <option value="bs_cf_balance">Balance Sheet = Cash Flow</option>
                  <option value="cash_balance">Cash Balance</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {/* NPV Settings */}
        {settings.npv && (
          <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs">
                  📊
                </span>
                NPV Discount Rate
              </h2>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Discount Rate (0-1)</label>
              <input
                type="number"
                min="0"
                max="1"
                step="0.001"
                value={settings.npv.discountRate || 0.1}
                onChange={(e) =>
                  updateSetting('npv', {
                    ...settings.npv!,
                    discountRate: parseFloat(e.target.value) || 0.1,
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
              />
            </div>
          </section>
        )}

        {/* Governance Rules */}
        {settings.governance && (
          <section className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white text-xs">
                  🔒
                </span>
                Governance Rules
              </h2>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.governance.approvalRequired || false}
                  onChange={(e) =>
                    updateSetting('governance', {
                      ...settings.governance!,
                      approvalRequired: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Approval Required</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Max Versions</label>
                <input
                  type="number"
                  min="1"
                  value={settings.governance.maxVersions || 10}
                  onChange={(e) =>
                    updateSetting('governance', {
                      ...settings.governance!,
                      maxVersions: parseInt(e.target.value) || 10,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-all"
                />
              </div>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}

