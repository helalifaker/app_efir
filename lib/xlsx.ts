// lib/xlsx.ts
// Excel export utilities using xlsx library

import * as XLSX from 'xlsx';
import { AppSettings, getSettings, DEFAULT_SETTINGS } from './getSettings';

/**
 * Format a number using admin settings
 */
function formatNumber(value: number | null | undefined, settings: AppSettings): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'number') return String(value);
  
  const { locale, decimals, compact } = settings.numberFormat;
  
  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    ...(compact && value >= 1000 ? { notation: 'compact' } : {}),
  });
}

/**
 * Convert JSON data to flat rows with stable ordering
 * Maps nested objects to key-value pairs, sorted alphabetically
 */
function jsonToRows(data: Record<string, unknown>, prefix = ''): Array<{ key: string; value: string | number }> {
  const rows: Array<{ key: string; value: string | number }> = [];
  const keys = Object.keys(data).sort(); // Stable ordering
  
  for (const key of keys) {
    const value = data[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value === null || value === undefined) {
      rows.push({ key: fullKey, value: '' });
    } else if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
      // Recursively process nested objects
      rows.push(...jsonToRows(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      // Handle arrays - convert to comma-separated or show length
      if (value.length === 0) {
        rows.push({ key: fullKey, value: '' });
      } else if (value.every(item => typeof item === 'object' && item !== null)) {
        // Array of objects - flatten each item
        value.forEach((item, index) => {
          rows.push(...jsonToRows(item as Record<string, unknown>, `${fullKey}[${index}]`));
        });
      } else {
        rows.push({ key: fullKey, value: value.join(', ') });
      }
    } else {
      rows.push({ key: fullKey, value: value as string | number });
    }
  }
  
  return rows;
}

/**
 * Export tab data to Excel with metadata header
 */
export async function exportTabToExcel(params: {
  tabName: string;
  data: Record<string, unknown>;
  metadata: {
    modelName: string;
    versionName: string;
    status: string;
    createdAt: string;
  };
  filename?: string;
}): Promise<void> {
  const { tabName, data, metadata, filename } = params;
  
  // Try to get settings, fallback to defaults if unavailable (client-side)
  let settings: AppSettings;
  try {
    settings = await getSettings();
  } catch {
    // If getSettings fails (e.g., client-side), use defaults
    settings = DEFAULT_SETTINGS;
  }
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Metadata sheet
  const metadataRows = [
    ['Model', metadata.modelName],
    ['Version', metadata.versionName],
    ['Status', metadata.status],
    ['Created At', metadata.createdAt],
    ['Export Date', new Date().toLocaleDateString(settings.numberFormat.locale)],
    [], // Empty row
  ];
  
  const metadataWs = XLSX.utils.aoa_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(wb, metadataWs, 'Metadata');
  
  // Data sheet
  const rows = jsonToRows(data);
  const dataRows = [
    ['Metric', 'Value'], // Header
    ...rows.map(row => [
      row.key,
      typeof row.value === 'number' 
        ? formatNumber(row.value, settings)
        : String(row.value)
    ]),
  ];
  
  const dataWs = XLSX.utils.aoa_to_sheet(dataRows);
  
  // Set column widths
  dataWs['!cols'] = [
    { wch: 30 }, // Metric column
    { wch: 20 }, // Value column
  ];
  
  XLSX.utils.book_append_sheet(wb, dataWs, tabName.toUpperCase());
  
  // Generate filename
  const safeVersionName = metadata.versionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const safeTabName = tabName.toLowerCase();
  const exportFilename = filename || `${safeVersionName}_${safeTabName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Download
  XLSX.writeFile(wb, exportFilename);
}

/**
 * Export compare data to Excel with deltas
 */
export async function exportCompareToExcel(params: {
  tabName: string;
  versions: Array<{
    id: string;
    name: string;
    status: string;
    model_name: string;
  }>;
  baselineId: string;
  dataByVersion: Record<string, Record<string, unknown>>;
  allKeys: string[];
  filename?: string;
}): Promise<void> {
  const { tabName, versions, baselineId, dataByVersion, allKeys, filename } = params;
  // Try to get settings, fallback to defaults if unavailable (client-side)
  let settings: AppSettings;
  try {
    settings = await getSettings();
  } catch {
    // If getSettings fails (e.g., client-side), use defaults
    settings = DEFAULT_SETTINGS;
  }
  
  // Find baseline
  const baseline = versions.find(v => v.id === baselineId);
  const baselineData = dataByVersion[baselineId] || {};
  
  // Create workbook
  const wb = XLSX.utils.book_new();
  
  // Metadata sheet
  const metadataRows = [
    ['Comparison Tab', tabName.toUpperCase()],
    ['Baseline Version', baseline?.name || baselineId],
    ['Export Date', new Date().toLocaleDateString(settings.numberFormat.locale)],
    [], // Empty row
    ['Versions Included:', ''],
    ...versions.map(v => [v.name, v.status]),
  ];
  
  const metadataWs = XLSX.utils.aoa_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(wb, metadataWs, 'Metadata');
  
  // Comparison sheet
  const comparisonRows: (string | number)[][] = [
    ['Metric', 'Baseline', ...versions.flatMap(v => 
      v.id === baselineId ? [] : [v.name, `${v.name} Δ`, `${v.name} Δ%`]
    )],
  ];
  
  // Sort keys for stable ordering
  const sortedKeys = [...allKeys].sort();
  
  for (const key of sortedKeys) {
    const baselineValue = baselineData[key];
    const baselineNum = typeof baselineValue === 'number' ? baselineValue : parseFloat(String(baselineValue)) || 0;
    
    const row: (string | number)[] = [
      key,
      formatNumber(baselineNum, settings),
    ];
    
    // Add comparison columns
    for (const version of versions) {
      if (version.id === baselineId) continue;
      
      const versionData = dataByVersion[version.id] || {};
      const versionValue = versionData[key];
      const versionNum = typeof versionValue === 'number' ? versionValue : parseFloat(String(versionValue)) || 0;
      
      const deltaAbs = versionNum - baselineNum;
      const deltaPct = baselineNum !== 0 ? (deltaAbs / baselineNum) * 100 : 0;
      
      row.push(
        formatNumber(versionNum, settings),
        formatNumber(deltaAbs, settings),
        `${deltaPct.toFixed(1)}%`,
      );
    }
    
    comparisonRows.push(row);
  }
  
  const comparisonWs = XLSX.utils.aoa_to_sheet(comparisonRows);
  
  // Set column widths
  comparisonWs['!cols'] = [
    { wch: 30 }, // Metric column
    { wch: 15 }, // Baseline column
    ...Array(versions.length - 1).fill(null).flatMap(() => [
      { wch: 15 }, // Value
      { wch: 12 }, // Δ
      { wch: 12 }, // Δ%
    ]),
  ];
  
  XLSX.utils.book_append_sheet(wb, comparisonWs, 'Comparison');
  
  // Generate filename
  const exportFilename = filename || `compare_${tabName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Download
  XLSX.writeFile(wb, exportFilename);
}

