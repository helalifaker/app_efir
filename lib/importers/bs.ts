// lib/importers/bs.ts
// CSV column mapping for Balance Sheet data

import { BsTab } from '../schemas/tabs';
import { ColumnMapping } from './pnl';

export const bsColumnMappings: ColumnMapping[] = [
  { csvColumn: 'assets', canonicalKey: 'assets', required: true },
  { csvColumn: 'Assets', canonicalKey: 'assets', required: true },
  { csvColumn: 'assets_current', canonicalKey: 'assets_current' },
  { csvColumn: 'Current Assets', canonicalKey: 'assets_current' },
  { csvColumn: 'assets_fixed', canonicalKey: 'assets_fixed' },
  { csvColumn: 'Fixed Assets', canonicalKey: 'assets_fixed' },
  { csvColumn: 'cash', canonicalKey: 'cash' },
  { csvColumn: 'Cash', canonicalKey: 'cash' },
  { csvColumn: 'receivables', canonicalKey: 'receivables' },
  { csvColumn: 'Receivables', canonicalKey: 'receivables' },
  { csvColumn: 'inventory', canonicalKey: 'inventory' },
  { csvColumn: 'Inventory', canonicalKey: 'inventory' },
  { csvColumn: 'property', canonicalKey: 'property' },
  { csvColumn: 'Property', canonicalKey: 'property' },
  { csvColumn: 'equipment', canonicalKey: 'equipment' },
  { csvColumn: 'Equipment', canonicalKey: 'equipment' },
  { csvColumn: 'liabilities', canonicalKey: 'liabilities', required: true },
  { csvColumn: 'Liabilities', canonicalKey: 'liabilities', required: true },
  { csvColumn: 'liabilities_current', canonicalKey: 'liabilities_current' },
  { csvColumn: 'Current Liabilities', canonicalKey: 'liabilities_current' },
  { csvColumn: 'liabilities_long_term', canonicalKey: 'liabilities_long_term' },
  { csvColumn: 'Long-term Liabilities', canonicalKey: 'liabilities_long_term' },
  { csvColumn: 'equity', canonicalKey: 'equity', required: true },
  { csvColumn: 'Equity', canonicalKey: 'equity', required: true },
  { csvColumn: 'retained_earnings', canonicalKey: 'retained_earnings' },
  { csvColumn: 'Retained Earnings', canonicalKey: 'retained_earnings' },
  { csvColumn: 'share_capital', canonicalKey: 'share_capital' },
  { csvColumn: 'Share Capital', canonicalKey: 'share_capital' },
];

/**
 * Parse CSV text and map to Balance Sheet structure
 */
export function parseBsCsv(csvText: string): {
  data: Partial<BsTab>;
  errors: string[];
} {
  const errors: string[] = [];
  const data: Partial<BsTab> = {};

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
    const mapped = bsColumnMappings.find(m => 
      m.csvColumn.toLowerCase() === header.toLowerCase()
    );
    if (mapped) {
      mapping[mapped.canonicalKey] = dataRow[index] || '';
    }
  });

  // Validate required fields
  const requiredFields = bsColumnMappings.filter(m => m.required);
  requiredFields.forEach(field => {
    if (!mapping[field.canonicalKey] || mapping[field.canonicalKey] === '') {
      errors.push(`Required field missing: ${field.canonicalKey}`);
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

