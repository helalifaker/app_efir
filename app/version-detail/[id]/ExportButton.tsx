// app/version-detail/[id]/ExportButton.tsx
'use client';

import { useState } from 'react';
import { exportTabToExcel } from '@/lib/xlsx';
import { exportTabToCsv } from '@/lib/csv';
import toast from 'react-hot-toast';
import ImportCsvModal from './ImportCsvModal';
import { TabType } from '@/lib/schemas/tabs';

type ExportButtonProps = {
  tabName: string;
  tab: TabType;
  versionId: string;
  data: Record<string, any>;
  metadata: {
    modelName: string;
    versionName: string;
    status: string;
    createdAt: string;
  };
};

export default function ExportButton({ tabName, tab, versionId, data, metadata }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (exporting) return;

    setExporting(true);
    try {
      if (format === 'xlsx') {
        await exportTabToExcel({ tabName, data, metadata });
        toast.success(`${tabName.toUpperCase()} exported to Excel`);
      } else {
        await exportTabToCsv({ tabName, data, metadata });
        toast.success(`${tabName.toUpperCase()} exported to CSV`);
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(`Failed to export ${tabName}: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };

  const canImport = ['pnl', 'bs', 'cf'].includes(tab);

  return (
    <>
      <div className="flex gap-2 mt-2">
        {canImport && metadata.status !== 'locked' && (
          <button
            onClick={() => setImportModalOpen(true)}
            className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-[10px]"
            title="Import from CSV"
          >
            📥 Import
          </button>
        )}
        <button
          onClick={() => handleExport('xlsx')}
          disabled={exporting}
          className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-[10px]"
          title="Export to Excel"
        >
          📊 Excel
        </button>
        <button
          onClick={() => handleExport('csv')}
          disabled={exporting}
          className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-[10px]"
          title="Export to CSV"
        >
          📄 CSV
        </button>
      </div>
      {importModalOpen && (
        <ImportCsvModal
          versionId={versionId}
          tab={tab}
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
        />
      )}
    </>
  );
}
