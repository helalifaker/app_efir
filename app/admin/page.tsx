'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

type Settings = {
  vat: { rate: number };
  numberFormat: { locale: 'en-US' | 'ar-SA'; decimals: 0 | 2; compact: boolean };
  validation: { requireTabs: string[]; bsTolerance: number };
  ui: { currency: string; theme: 'system' | 'light' | 'dark' };
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
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to load settings');
      const data = await res.json();
      setSettings(data);
    } catch (e) {
      console.error('Load error:', e);
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
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save');
      }

      setChanges({});
      toast.success('Settings saved successfully');
    } catch (e: any) {
      console.error('Save error:', e);
      toast.error(e.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  function resetSection<K extends keyof Settings>(key: K) {
    updateSetting(key, DEFAULT_SETTINGS[key]);
  }

  if (loading) {
    return (
      <main className="p-6">
        <div className="text-center text-gray-500">Loading settings...</div>
      </main>
    );
  }

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">Admin Settings</h1>
          <p className="text-sm text-gray-500">Manage application parameters</p>
        </div>
        {Object.keys(changes).length > 0 && (
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* VAT Settings */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">VAT</h2>
          <button
            onClick={() => resetSection('vat')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Reset to default
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">VAT Rate</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={settings.vat.rate}
            onChange={(e) => updateSetting('vat', { rate: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter as decimal (0.15 = 15%)
          </p>
        </div>
      </section>

      {/* Number Format Settings */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Number Format</h2>
          <button
            onClick={() => resetSection('numberFormat')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Reset to default
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Locale</label>
            <select
              value={settings.numberFormat.locale}
              onChange={(e) =>
                updateSetting('numberFormat', {
                  ...settings.numberFormat,
                  locale: e.target.value as 'en-US' | 'ar-SA',
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="en-US">English (US)</option>
              <option value="ar-SA">Arabic (SA)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Decimal Places</label>
            <select
              value={settings.numberFormat.decimals}
              onChange={(e) =>
                updateSetting('numberFormat', {
                  ...settings.numberFormat,
                  decimals: parseInt(e.target.value) as 0 | 2,
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
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
          <label htmlFor="compact" className="text-sm">
            Use compact notation (e.g., 1.2K, 1.5M)
          </label>
        </div>
      </section>

      {/* Validation Settings */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Validation Rules</h2>
          <button
            onClick={() => resetSection('validation')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Reset to default
          </button>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Required Tabs</label>
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
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="overview, pnl, bs, cf"
          />
          <p className="text-xs text-gray-500 mt-1">Comma-separated list</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Balance Sheet Tolerance</label>
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
            className="w-full px-3 py-2 border rounded-lg"
          />
          <p className="text-xs text-gray-500 mt-1">
            Maximum difference allowed (default: 0.01)
          </p>
        </div>
      </section>

      {/* UI Settings */}
      <section className="border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">UI Settings</h2>
          <button
            onClick={() => resetSection('ui')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Reset to default
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Currency</label>
            <input
              type="text"
              value={settings.ui.currency}
              onChange={(e) =>
                updateSetting('ui', { ...settings.ui, currency: e.target.value })
              }
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="SAR"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <select
              value={settings.ui.theme}
              onChange={(e) =>
                updateSetting('ui', {
                  ...settings.ui,
                  theme: e.target.value as 'system' | 'light' | 'dark',
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </section>

      {/* Save Button (repeat for mobile) */}
      {Object.keys(changes).length > 0 && (
        <div className="sticky bottom-0 bg-white border-t p-4">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      )}
    </main>
  );
}

