// lib/importers/cf.ts
// CSV column mapping for Cash Flow data

import { CfTab } from '../schemas/tabs';
import { ColumnMapping } from './pnl';

export const cfColumnMappings: ColumnMapping[] = [
  { csvColumn: 'operating', canonicalKey: 'operating' },
  { csvColumn: 'Operating', canonicalKey: 'operating' },
  { csvColumn: 'operating_cash_in', canonicalKey: 'operating_cash_in' },
  { csvColumn: 'Operating Cash In', canonicalKey: 'operating_cash_in' },
  { csvColumn: 'operating_cash_out', canonicalKey: 'operating_cash_out' },
  { csvColumn: 'Operating Cash Out', canonicalKey: 'operating_cash_out' },
  { csvColumn: 'investing', canonicalKey: 'investing' },
  { csvColumn: 'Investing', canonicalKey: 'investing' },
  { csvColumn: 'investing_cash_in', canonicalKey: 'investing_cash_in' },
  { csvColumn: 'Investing Cash In', canonicalKey: 'investing_cash_in' },
  { csvColumn: 'investing_cash_out', canonicalKey: 'investing_cash_out' },
  { csvColumn: 'Investing Cash Out', canonicalKey: 'investing_cash_out' },
  { csvColumn: 'financing', canonicalKey: 'financing' },
  { csvColumn: 'Financing', canonicalKey: 'financing' },
  { csvColumn: 'financing_cash_in', canonicalKey: 'financing_cash_in' },
  { csvColumn: 'Financing Cash In', canonicalKey: 'financing_cash_in' },
  { csvColumn: 'financing_cash_out', canonicalKey: 'financing_cash_out' },
  { csvColumn: 'Financing Cash Out', canonicalKey: 'financing_cash_out' },
  { csvColumn: 'net_change', canonicalKey: 'net_change' },
  { csvColumn: 'Net Change', canonicalKey: 'net_change' },
  { csvColumn: 'beginning_cash', canonicalKey: 'beginning_cash' },
  { csvColumn: 'Beginning Cash', canonicalKey: 'beginning_cash' },
  { csvColumn: 'ending_cash', canonicalKey: 'ending_cash' },
  { csvColumn: 'Ending Cash', canonicalKey: 'ending_cash' },
];

/**
 * Parse CSV text and map to Cash Flow structure
 */
export function parseCfCsv(csvText: string): {
  data: Partial<CfTab>;
  errors: string[];
} {
  const errors: string[] = [];
  const data: Partial<CfTab> = {};

  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    errors.push('CSV must have at least a header row and one data row');
    return { data, errors };
  }

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const dataRow = lines[1].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

  // Create mapping from CSV headers to canonical keys
  const mapping: Record<string, string> = {};
  headers.forEach((header, index) => {
    const mapped = cfColumnMappings.find(m => 
      m.csvColumn.toLowerCase() === header.toLowerCase()
    );
    if (mapped) {
      mapping[mapped.canonicalKey] = dataRow[index] || '';
    }
  });

  // Convert values to numbers where appropriate
  Object.keys(mapping).forEach(key => {
    const value = mapping[key];
    if (value && value !== '') {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        (data as any)[key] = num;
      } else {
        errors.push(`Invalid number for ${key}: ${value}`);
      }
    }
  });

  return { data, errors };
}

