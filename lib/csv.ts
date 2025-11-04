// lib/csv.ts
// CSV export utilities

/**
 * Escape a CSV field value
 */
export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Convert an array of arrays to CSV string
 */
export function arrayToCsv(rows: (string | number | null | undefined)[][]): string {
  return rows.map(row => 
    row.map(cell => {
      if (cell === null || cell === undefined) return '';
      const str = String(cell);
      return escapeCsvField(str);
    }).join(',')
  ).join('\n');
}

/**
 * Download CSV as file
 */
export function downloadCsv(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
      // Handle arrays
      if (value.length === 0) {
        rows.push({ key: fullKey, value: '' });
      } else if (value.every(item => typeof item === 'object' && item !== null)) {
        // Array of objects - flatten each item
        value.forEach((item, index) => {
          rows.push(...jsonToRows(item, `${fullKey}[${index}]`));
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
 * Export tab data to CSV with metadata header
 */
export async function exportTabToCsv(params: {
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
  
  const rows: string[][] = [
    // Metadata header
    ['Model', metadata.modelName],
    ['Version', metadata.versionName],
    ['Status', metadata.status],
    ['Created At', metadata.createdAt],
    ['Export Date', new Date().toLocaleDateString()],
    [], // Empty row
    ['Metric', 'Value'], // Data header
  ];
  
  // Add data rows
  const dataRows = jsonToRows(data);
  rows.push(...dataRows.map(row => [row.key, String(row.value)]));
  
  const csvContent = arrayToCsv(rows);
  const safeVersionName = metadata.versionName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const safeTabName = tabName.toLowerCase();
  const exportFilename = filename || `${safeVersionName}_${safeTabName}_${new Date().toISOString().split('T')[0]}.csv`;
  
  downloadCsv(csvContent, exportFilename);
}

/**
 * Generate CSV content for comparison data
 */
export type CompareCsvRow = {
  metric: string;
  baselineValue: string | number;
  comparisons: Array<{
    versionName: string;
    value: string | number;
    deltaAbs: string | number;
    deltaPct: string | number;
  }>;
};

export function generateCompareCsv(rows: CompareCsvRow[]): string {
  if (rows.length === 0) return '';
  
  // Build header
  const headers: string[] = ['Metric'];
  if (rows[0].comparisons.length > 0) {
    // Add baseline header
    headers.push(rows[0].baselineValue.toString());
    
    // Add comparison headers (each with 3 columns: value, Δ abs, Δ %)
    rows[0].comparisons.forEach(comp => {
      headers.push(comp.versionName, `${comp.versionName} Δ Abs`, `${comp.versionName} Δ %`);
    });
  }
  
  const csvRows: (string | number)[][] = [headers];
  
  // Add data rows
  rows.forEach(row => {
    const csvRow: (string | number)[] = [row.metric, row.baselineValue];
    row.comparisons.forEach(comp => {
      csvRow.push(comp.value, comp.deltaAbs, comp.deltaPct);
    });
    csvRows.push(csvRow);
  });
  
  return arrayToCsv(csvRows);
}

