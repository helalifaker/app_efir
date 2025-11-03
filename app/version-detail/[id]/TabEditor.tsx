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

type TabEditorProps = {
  versionId: string;
  tab: TabType;
  initialData: Record<string, any>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues: initialData,
    mode: 'onChange',
  });

  // Watch all form values for autosave
  const formValues = watch();
  const debouncedValues = useDebounce(formValues, 800);

  // Autosave when debounced values change
  useEffect(() => {
    if (isDirty && Object.keys(debouncedValues).length > 0) {
      // Only autosave if form is valid (no errors)
      if (Object.keys(errors).length === 0) {
        saveTab(debouncedValues);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValues, isDirty, errors]);

  const saveTab = useCallback(async (data: Record<string, any>) => {
    if (saving) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/version-tabs/${versionId}/${tab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (!res.ok) {
        const error = await res.json();
        console.error('Tab save error:', { status: res.status, error, versionId, tab });
        
        // Show detailed error message
        let errorMessage = error.error || 'Failed to save';
        if (error.details && Array.isArray(error.details) && error.details.length > 0) {
          const detailMessages = error.details.map((d: any) => d.message || d).join(', ');
          errorMessage = `${errorMessage}: ${detailMessages}`;
        }
        
        toast.error(`Failed to save ${tab.toUpperCase()}: ${errorMessage}`);
        return; // Don't throw, just show error and stop
      }

      const result = await res.json();
      reset(result.data, { keepDirty: false });
      setLastSaved(new Date());
      
      // Refresh to show updated data
      router.refresh();
    } catch (error: any) {
      console.error('Unexpected save error:', error);
      toast.error(`Failed to save ${tab.toUpperCase()}: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }, [versionId, tab, reset, router, saving]);

  // Extract field names from schema (simplified - show common fields)
  const getFieldNames = (): string[] => {
    const commonFields: Record<TabType, string[]> = {
      overview: ['summary', 'description', 'period', 'fiscal_year', 'notes'],
      pnl: ['revenue', 'students_count', 'avg_tuition_fee', 'cost_of_sales', 'operating_expenses', 'ebit', 'net_income'],
      bs: ['assets', 'assets_current', 'assets_fixed', 'cash', 'receivables', 'equity', 'liabilities'],
      cf: ['operating', 'investing', 'financing', 'beginning_cash', 'ending_cash'],
      capex: ['total_capex', 'planned_capex', 'actual_capex'],
      controls: ['status', 'last_check', 'notes'],
    };

    return commonFields[tab] || Object.keys(initialData).slice(0, 10);
  };

  const fieldNames = getFieldNames();

  // Derived fields (read-only, computed by server)
  const derivedFields: Record<TabType, string[]> = {
    overview: [],
    pnl: ['gross_profit', 'ebitda', 'margin_percentage'],
    bs: [],
    cf: ['net_change'],
    capex: [],
    controls: [],
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit((data) => saveTab(data))} className="space-y-3">
        {fieldNames.map((fieldName) => {
          const value = formValues[fieldName];
          const fieldError = errors[fieldName];
          const isDerived = derivedFields[tab]?.includes(fieldName);

          return (
            <div key={fieldName} className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">
                {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                {isDerived && <span className="ml-1 text-gray-400">(calculated)</span>}
              </label>
              {isDerived ? (
                <input
                  type="text"
                  value={value ?? ''}
                  readOnly
                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50 text-gray-600"
                />
              ) : (
                <>
                  <input
                    type={typeof value === 'number' ? 'number' : 'text'}
                    step={typeof value === 'number' ? 'any' : undefined}
                    {...register(fieldName, {
                      valueAsNumber: typeof value === 'number',
                    })}
                    className={`w-full px-2 py-1 text-xs border rounded ${
                      fieldError
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                    }`}
                  />
                  {fieldError && (
                    <p className="text-[10px] text-red-600">
                      {fieldError.message as string}
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
              <div key={fieldName} className="space-y-1">
                <label className="block text-xs font-medium text-gray-700">
                  {fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </label>
                <input
                  type={typeof value === 'number' ? 'number' : 'text'}
                  step={typeof value === 'number' ? 'any' : undefined}
                  {...register(fieldName, {
                    valueAsNumber: typeof value === 'number',
                  })}
                  className={`w-full px-2 py-1 text-xs border rounded ${
                    fieldError
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
                  }`}
                />
                {fieldError && (
                  <p className="text-[10px] text-red-600">
                    {fieldError.message as string}
                  </p>
                )}
              </div>
            );
          })}
      </form>

      {/* Status bar */}
      <div className="flex items-center justify-between text-[10px] text-gray-500 pt-2 border-t">
        <div className="flex items-center gap-2">
          {saving && <span className="text-blue-600">Saving...</span>}
          {!saving && isDirty && <span className="text-yellow-600">Unsaved changes</span>}
          {!saving && !isDirty && lastSaved && (
            <span className="text-green-600">
              Saved {lastSaved.toLocaleTimeString()}
            </span>
          )}
        </div>
        {Object.keys(errors).length > 0 && (
          <span className="text-red-600">
            {Object.keys(errors).length} error(s)
          </span>
        )}
      </div>
    </div>
  );
}

