// app/version-detail/[id]/ImportCsvModal.tsx
// Modal for CSV import with preview

'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { parsePnlCsv } from '@/lib/importers/pnl';
import { parseBsCsv } from '@/lib/importers/bs';
import { parseCfCsv } from '@/lib/importers/cf';
import { TabType } from '@/lib/schemas/tabs';
import { logger } from '@/lib/logger';

type ImportCsvModalProps = {
  versionId: string;
  tab: TabType;
  isOpen: boolean;
  onClose: () => void;
};

export default function ImportCsvModal({ versionId, tab, isOpen, onClose }: ImportCsvModalProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState('');
  const [previewData, setPreviewData] = useState<Record<string, unknown> | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file);
  };

  const parseCsv = (text: string) => {
    let result: { data: Record<string, unknown>; errors: string[] };

    if (tab === 'pnl') {
      result = parsePnlCsv(text);
    } else if (tab === 'bs') {
      result = parseBsCsv(text);
    } else if (tab === 'cf') {
      result = parseCfCsv(text);
    } else {
      setErrors(['CSV import only supported for P&L, BS, and CF tabs']);
      return;
    }

    setPreviewData(result.data);
    setErrors(result.errors);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text');
    if (text) {
      setCsvText(text);
      parseCsv(text);
    }
  };

  const handleApply = async () => {
    if (!previewData || errors.length > 0) {
      toast.error('Please fix errors before importing');
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`/api/version-tabs/${versionId}/${tab}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: previewData }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to import');
      }

      toast.success(`${tab.toUpperCase()} data imported successfully`);
      router.refresh();
      onClose();
      setCsvText('');
      setPreviewData(null);
      setErrors([]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import';
      logger.error('CSV import failed', error, { versionId, tab });
      toast.error(`Failed to import: ${errorMessage}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Import CSV - {tab.toUpperCase()}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* File input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {/* Or paste */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or Paste CSV
            </label>
            <textarea
              value={csvText}
              onChange={(e) => {
                setCsvText(e.target.value);
                if (e.target.value) {
                  parseCsv(e.target.value);
                }
              }}
              onPaste={handlePaste}
              placeholder="Paste CSV data here (header row + data row)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono"
              rows={4}
            />
          </div>

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded p-3">
              <p className="text-sm font-medium text-red-800 mb-1">Errors:</p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {errors.map((error, idx) => (
                  <li key={idx}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Preview */}
          {previewData && Object.keys(previewData).length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
              <div className="border rounded p-3 bg-gray-50 max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">Field</th>
                      <th className="text-right py-1">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(previewData).map(([key, value]) => (
                      <tr key={key} className="border-b">
                        <td className="py-1 font-medium">{key}</td>
                        <td className="text-right py-1 font-mono">
                          {typeof value === 'number' ? value.toLocaleString() : String(value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!previewData || errors.length > 0 || importing}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Apply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

