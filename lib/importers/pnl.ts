// lib/importers/pnl.ts
// CSV column mapping for P&L data

import { z } from 'zod';
import { PnlTab } from '../schemas/tabs';

export type ColumnMapping = {
  csvColumn: string;
  canonicalKey: string;
  required?: boolean;
};

export const pnlColumnMappings: ColumnMapping[] = [
  { csvColumn: 'revenue', canonicalKey: 'revenue', required: true },
  { csvColumn: 'Revenue', canonicalKey: 'revenue', required: true },
  { csvColumn: 'students_count', canonicalKey: 'students_count' },
  { csvColumn: 'Students Count', canonicalKey: 'students_count' },
  { csvColumn: 'avg_tuition_fee', canonicalKey: 'avg_tuition_fee' },
  { csvColumn: 'Average Tuition Fee', canonicalKey: 'avg_tuition_fee' },
  { csvColumn: 'cost_of_sales', canonicalKey: 'cost_of_sales' },
  { csvColumn: 'Cost of Sales', canonicalKey: 'cost_of_sales' },
  { csvColumn: 'operating_expenses', canonicalKey: 'operating_expenses' },
  { csvColumn: 'Operating Expenses', canonicalKey: 'operating_expenses' },
  { csvColumn: 'depreciation', canonicalKey: 'depreciation' },
  { csvColumn: 'Depreciation', canonicalKey: 'depreciation' },
  { csvColumn: 'amortization', canonicalKey: 'amortization' },
  { csvColumn: 'Amortization', canonicalKey: 'amortization' },
  { csvColumn: 'gross_profit', canonicalKey: 'gross_profit' },
  { csvColumn: 'Gross Profit', canonicalKey: 'gross_profit' },
  { csvColumn: 'ebit', canonicalKey: 'ebit' },
  { csvColumn: 'EBIT', canonicalKey: 'ebit' },
  { csvColumn: 'ebitda', canonicalKey: 'ebitda' },
  { csvColumn: 'EBITDA', canonicalKey: 'ebitda' },
  { csvColumn: 'interest_expense', canonicalKey: 'interest_expense' },
  { csvColumn: 'Interest Expense', canonicalKey: 'interest_expense' },
  { csvColumn: 'tax_expense', canonicalKey: 'tax_expense' },
  { csvColumn: 'Tax Expense', canonicalKey: 'tax_expense' },
  { csvColumn: 'net_income', canonicalKey: 'net_income' },
  { csvColumn: 'Net Income', canonicalKey: 'net_income' },
];

/**
 * Parse CSV text and map to P&L structure
 */
export function parsePnlCsv(csvText: string): {
  data: Partial<PnlTab>;
  errors: string[];
} {
  const errors: string[] = [];
  const data: Partial<PnlTab> = {};

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
    const mapped = pnlColumnMappings.find(m => 
      m.csvColumn.toLowerCase() === header.toLowerCase()
    );
    if (mapped) {
      mapping[mapped.canonicalKey] = dataRow[index] || '';
    }
  });

  // Validate required fields
  const requiredFields = pnlColumnMappings.filter(m => m.required);
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

