// app/version-detail/[id]/TabEditor.tsx
// Inline editor for version tabs with autosave

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { TabType, tabSchemas } from '@/lib/schemas/tabs';
import { logger } from '@/lib/logger';
import { useAuth } from '@/app/providers/AuthProvider';

type TabEditorProps = {
  versionId: string;
  tab: TabType;
  initialData: Record<string, unknown>;
  metadata: {
    modelName: string;
    versionName: string;
    status: string;
    createdAt: string;
  };
};

// Debounce utility
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function TabEditor({ versionId, tab, initialData }: TabEditorProps) {
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Get schema for this tab
  const schema = tabSchemas[tab] || z.object({}).passthrough();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(schema as any),
    defaultValues: initialData,
    mode: 'onChange',
  });

  // Watch all form values for autosave
  const formValues = watch();
  const debouncedValues = useDebounce(formValues, 800);

  // Autosave when debounced values change
  useEffect(() => {
    // Don't autosave if user is not authenticated
    if (authLoading || !session) {
      return;
    }
    
    if (isDirty && Object.keys(debouncedValues).length > 0) {
      // Only autosave if form is valid (no errors)
      if (Object.keys(errors).length === 0) {
        saveTab(debouncedValues);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValues, isDirty, errors, session, authLoading]);

  const saveTab = useCallback(async (data: Record<string, unknown>) => {
    if (saving) return;
    
    // Check authentication before attempting save
    if (!session) {
      toast.error('Please log in to save changes', {
        duration: 5000,
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/version-tabs/${versionId}/${tab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to save' }));
        
        // Handle authentication errors specially
        if (res.status === 401) {
          toast.error(
            (t) => (
              <div onClick={() => { window.location.href = '/login'; toast.dismiss(t.id); }}>
                <div className="font-semibold">Authentication Required</div>
                <div className="text-sm mt-1">Please log in to save changes</div>
                <div className="text-xs mt-1 underline">Click to go to login →</div>
              </div>
            ),
            { duration: 5000 }
          );
          logger.warn('Tab save failed - authentication required', {
            versionId,
            tab,
          });
          return;
        }
        
        logger.error('Tab save failed', undefined, {
          versionId,
          tab,
          httpStatus: res.status,
          error: error.error,
        });
        
        // Show detailed error message for other errors
        let errorMessage = error.error || 'Failed to save';
        if (error.details && Array.isArray(error.details) && error.details.length > 0) {
          const detailMessages = error.details.map((d: unknown) => {
            if (typeof d === 'object' && d !== null && 'message' in d) {
              return String((d as { message: string }).message);
            }
            return String(d);
          }).join(', ');
          errorMessage = `${errorMessage}: ${detailMessages}`;
        }
        
        toast.error(`Failed to save ${tab.toUpperCase()}: ${errorMessage}`);
        return;
      }

      const result = await res.json();
      reset(result.data, { keepDirty: false });
      setLastSaved(new Date());
      
      logger.debug('Tab saved successfully', { versionId, tab });
      
      // Refresh to show updated data
      router.refresh();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Unexpected error during tab save', error, { versionId, tab });
      toast.error(`Failed to save ${tab.toUpperCase()}: ${errorMessage}`);
    } finally {
      setSaving(false);
    }
  }, [versionId, tab, reset, router, saving]);

  // Extract field names from schema (simplified - show common fields)
  const getFieldNames = (): string[] => {
    const commonFields: Record<TabType, string[]> = {
      assumptions: ['notes', 'key_assumptions'],
      overview: ['summary', 'description', 'period', 'fiscal_year', 'notes'],
      pnl: ['revenue', 'students_count', 'avg_tuition_fee', 'cost_of_sales', 'operating_expenses', 'ebit', 'net_income'],
      bs: ['assets', 'assets_current', 'assets_fixed', 'cash', 'receivables', 'equity', 'liabilities'],
      cf: ['operating', 'investing', 'financing', 'beginning_cash', 'ending_cash'],
      capex: ['total_capex', 'planned_capex', 'actual_capex'],
      validation: ['status', 'last_check', 'notes'],
    };

    return commonFields[tab] || Object.keys(initialData).slice(0, 10);
  };

  const fieldNames = getFieldNames();

  // Derived fields (read-only, computed by server)
  const derivedFields: Record<TabType, string[]> = {
    assumptions: [],
    overview: [],
    pnl: ['gross_profit', 'ebitda', 'margin_percentage'],
    bs: [],
    cf: ['net_change'],
    capex: [],
    validation: [],
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit((data) => saveTab(data))} className="space-y-3">
        {fieldNames.map((fieldName) => {
          const value = formValues[fieldName];
          const fieldError = errors[fieldName];
          const isDerived = derivedFields[tab]?.includes(fieldName);

          return (
            <div key={fieldName} className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                {isDerived && (
                  <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-normal">
                    calculated
                  </span>
                )}
              </label>
              {isDerived ? (
                <input
                  type="text"
                  value={value ?? ''}
                  readOnly
                  className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 font-mono"
                />
              ) : (
                <>
                  <input
                    type={typeof value === 'number' ? 'number' : 'text'}
                    step={typeof value === 'number' ? 'any' : undefined}
                    {...register(fieldName, {
                      valueAsNumber: typeof value === 'number',
                    })}
                    className={`w-full px-3 py-2 text-sm border rounded-lg transition-all ${
                      fieldError
                        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800'
                    }`}
                  />
                  {fieldError && (
                    <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                      <span>⚠</span>
                      <span>{fieldError.message as string}</span>
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Additional fields not in common list */}
        {Object.keys(formValues)
          .filter(key => !fieldNames.includes(key) && !derivedFields[tab]?.includes(key))
          .slice(0, 5)
          .map((fieldName) => {
            const value = formValues[fieldName];
            const fieldError = errors[fieldName];

            return (
              <div key={fieldName} className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </label>
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  step={typeof value === 'number' ? 'any' : undefined}
                  {...register(fieldName, {
                    valueAsNumber: typeof value === 'number',
                  })}
                  className={`w-full px-3 py-2 text-sm border rounded-lg transition-all ${
                    fieldError
                      ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 focus:border-red-500 focus:ring-2 focus:ring-red-200 dark:focus:ring-red-800'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800'
                  }`}
                />
                {fieldError && (
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                    <span>⚠</span>
                    <span>{fieldError.message as string}</span>
                  </p>
                )}
              </div>
            );
          })}
      </form>

      {/* Status bar */}
      <div className="flex items-center justify-between text-xs pt-3 mt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          {saving && (
            <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
              <span className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></span>
              <span>Saving...</span>
            </span>
          )}
          {!saving && isDirty && (
            <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <span>⚠</span>
              <span>Unsaved changes</span>
            </span>
          )}
          {!saving && !isDirty && lastSaved && (
            <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
              <span>✓</span>
              <span>Saved {lastSaved.toLocaleTimeString()}</span>
            </span>
          )}
        </div>
        {Object.keys(errors).length > 0 && (
          <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
            <span>⚠</span>
            <span>{Object.keys(errors).length} error(s)</span>
          </span>
        )}
      </div>
    </div>
  );
}

