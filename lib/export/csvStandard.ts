// lib/export/csvStandard.ts
// Global CSV Export Standard - Locked Blueprint
// 
// Rules:
// - UTF-8 encoding
// - LF line endings (Unix-style)
// - Dot (.) decimal separator
// - Empty string for null values
// - Locked header order
// - RFC 4180 compliant (quoted fields when needed)

/**
 * Escape a CSV field value per RFC 4180
 * Fields containing comma, double quote, or newline must be quoted
 * Double quotes within fields are escaped as ""
 */
export function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format a value for CSV export
 * - null/undefined → empty string
 * - numbers → dot decimal separator (e.g., "1234.56")
 * - strings → escaped if needed
 */
export function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value === 'number') {
    // Use dot as decimal separator
    return String(value);
  }
  
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  
  // String: escape if needed
  return escapeCsvField(String(value));
}

/**
 * Convert array of rows to CSV string (UTF-8, LF line endings)
 * Each row is an array of values
 */
export function arrayToCsv(
  rows: (string | number | null | undefined | boolean)[][]
): string {
  if (rows.length === 0) {
    return '';
  }
  
  const csvRows = rows.map((row) =>
    row.map(formatCsvValue).join(',')
  );
  
  // Join with LF (Unix-style line ending)
  return csvRows.join('\n');
}

/**
 * Generate CSV content with metadata header
 * 
 * @param metadata - Metadata rows (array of [key, value] pairs)
 * @param headers - Column headers
 * @param dataRows - Data rows (each row is an array matching header length)
 */
export function generateCsvWithMetadata(params: {
  metadata?: Array<[string, string]>;
  headers: string[];
  dataRows: (string | number | null | undefined | boolean)[][];
}): string {
  const { metadata = [], headers, dataRows } = params;
  
  const rows: (string | number | null | undefined | boolean)[][] = [];
  
  // Add metadata rows
  if (metadata.length > 0) {
    metadata.forEach(([key, value]) => {
      rows.push([key, value]);
    });
    rows.push([]); // Empty row separator
  }
  
  // Add headers
  rows.push(headers);
  
  // Add data rows
  rows.push(...dataRows);
  
  return arrayToCsv(rows);
}

/**
 * Download CSV as file (browser-only)
 * 
 * @param content - CSV string content
 * @param filename - Filename (should end with .csv)
 */
export function downloadCsv(content: string, filename: string): void {
  if (typeof window === 'undefined') {
    throw new Error('downloadCsv can only be called in the browser');
  }
  
  // Create Blob with UTF-8 encoding
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Format number with dot decimal separator
 * (No thousands separator for CSV, just dot decimal)
 */
export function formatNumberForCsv(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  // Use dot as decimal separator, no thousands separator
  // Convert to string (handles scientific notation if needed)
  return String(value);
}

/**
 * Generate CSV filename with timestamp
 * 
 * @param baseName - Base name (e.g., 'export', 'compare')
 * @param suffix - Optional suffix (e.g., 'pnl', 'bs')
 * @param extension - File extension (default: 'csv')
 */
export function generateCsvFilename(
  baseName: string,
  suffix?: string,
  extension: string = 'csv'
): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const safeBase = baseName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const safeSuffix = suffix ? `_${suffix.replace(/[^a-z0-9]/gi, '_').toLowerCase()}` : '';
  return `${safeBase}${safeSuffix}_${date}.${extension}`;
}

/**
 * Validate CSV content (basic checks)
 */
export function validateCsv(content: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!content || content.trim().length === 0) {
    errors.push('CSV content is empty');
    return { valid: false, errors };
  }
  
  const lines = content.split('\n');
  
  if (lines.length === 0) {
    errors.push('CSV has no lines');
    return { valid: false, errors };
  }
  
  // Check for consistent column count (basic check)
  const headerCount = lines[0].split(',').length;
  for (let i = 1; i < Math.min(lines.length, 100); i++) { // Check first 100 rows
    const rowCount = lines[i].split(',').length;
    if (rowCount !== headerCount && lines[i].trim().length > 0) {
      errors.push(`Row ${i + 1} has ${rowCount} columns, expected ${headerCount}`);
      if (errors.length >= 5) break; // Limit errors
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
