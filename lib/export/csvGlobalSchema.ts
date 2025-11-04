// lib/export/csvGlobalSchema.ts
// Global CSV Export Standard - Locked Blueprint Implementation
// 
// Exact header order per blueprint:
// page, section, version_id, version_name, status, override_flag, metric, unit, pivot_year, year, row_key, row_label, value
//
// Rules:
// - UTF-8 encoding
// - LF line endings (Unix-style)
// - Dot (.) decimal separator
// - Empty string for null values
// - RFC 4180 compliant (quoted fields when needed)

import { arrayToCsv, formatCsvValue, generateCsvFilename } from './csvStandard';
import { PIVOT_YEARS, Year, PivotYear } from '@/types';

// ============================================================================
// GLOBAL CSV ROW TYPE
// ============================================================================

export type GlobalCsvRow = {
  page: string; // 'compare', 'dashboard', 'version', 'financial-report'
  section: string; // 'kpi_ribbon', 'series', 'pnl_summary', 'costs', 'ratios'
  version_id: string;
  version_name: string;
  status: 'Draft' | 'Ready' | 'Locked' | 'Archived';
  override_flag: boolean;
  metric: string; // MetricKey or row identifier
  unit: string; // 'SAR', '%', 'SAR/student', 'count', etc.
  pivot_year: PivotYear | ''; // Empty for non-pivot rows
  year: Year | ''; // Empty for non-time-series rows
  row_key: string; // Canonical key for the row (e.g., 'revenue', 'ebitda_margin')
  row_label: string; // Human-readable label
  value: number | null;
};

// ============================================================================
// CSV HEADER (locked order)
// ============================================================================

export const GLOBAL_CSV_HEADER: (keyof GlobalCsvRow)[] = [
  'page',
  'section',
  'version_id',
  'version_name',
  'status',
  'override_flag',
  'metric',
  'unit',
  'pivot_year',
  'year',
  'row_key',
  'row_label',
  'value',
];

// ============================================================================
// UNIT MAPPING
// ============================================================================

export const METRIC_UNIT_MAP: Record<string, string> = {
  // Revenue metrics
  revenue: 'SAR',
  students_count: 'count',
  avg_tuition_fee: 'SAR',
  other_income: 'SAR',
  
  // P&L metrics
  cost_of_sales: 'SAR',
  gross_profit: 'SAR',
  operating_expenses: 'SAR',
  ebitda: 'SAR',
  ebit: 'SAR',
  net_income: 'SAR',
  ebitda_margin: '%',
  
  // Balance Sheet
  assets: 'SAR',
  assets_current: 'SAR',
  cash: 'SAR',
  receivables: 'SAR',
  assets_fixed: 'SAR',
  liabilities: 'SAR',
  liabilities_current: 'SAR',
  debt: 'SAR',
  equity: 'SAR',
  retained_earnings: 'SAR',
  
  // Cash Flow
  cf_operating: 'SAR',
  cf_investing: 'SAR',
  cf_financing: 'SAR',
  cf_net_change: 'SAR',
  cash_beginning: 'SAR',
  cash_ending: 'SAR',
  
  // Ratios & percentages
  rent_load: '%',
  cost_per_student: 'SAR/student',
  margin_percentage: '%',
  
  // Default
  default: '',
};

/**
 * Get unit for a metric key
 */
export function getMetricUnit(metricKey: string): string {
  return METRIC_UNIT_MAP[metricKey] || METRIC_UNIT_MAP.default;
}

// ============================================================================
// ROW LABEL MAPPING
// ============================================================================

export const METRIC_LABEL_MAP: Record<string, string> = {
  revenue: 'Revenue',
  students_count: 'Students Count',
  avg_tuition_fee: 'Average Tuition Fee',
  other_income: 'Other Income',
  cost_of_sales: 'Cost of Sales',
  gross_profit: 'Gross Profit',
  operating_expenses: 'Operating Expenses',
  ebitda: 'EBITDA',
  ebit: 'EBIT',
  net_income: 'Net Income',
  ebitda_margin: 'EBITDA Margin',
  assets: 'Total Assets',
  assets_current: 'Current Assets',
  cash: 'Cash',
  receivables: 'Receivables',
  assets_fixed: 'Fixed Assets',
  liabilities: 'Total Liabilities',
  liabilities_current: 'Current Liabilities',
  debt: 'Debt',
  equity: 'Equity',
  retained_earnings: 'Retained Earnings',
  cf_operating: 'Operating Cash Flow',
  cf_investing: 'Investing Cash Flow',
  cf_financing: 'Financing Cash Flow',
  cf_net_change: 'Net Cash Change',
  cash_beginning: 'Beginning Cash',
  cash_ending: 'Ending Cash',
  rent_load: 'Rent Load',
  cost_per_student: 'Cost per Student',
  margin_percentage: 'Margin Percentage',
};

/**
 * Get human-readable label for a metric key
 */
export function getMetricLabel(metricKey: string): string {
  return METRIC_LABEL_MAP[metricKey] || metricKey;
}

// ============================================================================
// CSV GENERATION
// ============================================================================

/**
 * Convert GlobalCsvRow array to CSV string
 */
export function generateGlobalCsv(rows: GlobalCsvRow[]): string {
  if (rows.length === 0) {
    return GLOBAL_CSV_HEADER.join(',');
  }

  // Build CSV rows
  const csvRows: string[][] = [
    // Header
    GLOBAL_CSV_HEADER,
    // Data rows
    ...rows.map(row => [
      formatCsvValue(row.page),
      formatCsvValue(row.section),
      formatCsvValue(row.version_id),
      formatCsvValue(row.version_name),
      formatCsvValue(row.status),
      formatCsvValue(row.override_flag ? 'true' : 'false'),
      formatCsvValue(row.metric),
      formatCsvValue(row.unit),
      formatCsvValue(row.pivot_year || ''),
      formatCsvValue(row.year || ''),
      formatCsvValue(row.row_key),
      formatCsvValue(row.row_label),
      formatCsvValue(row.value),
    ]),
  ];

  return arrayToCsv(csvRows);
}

/**
 * Create KPI ribbon row
 */
export function createKpiRow(params: {
  page: string;
  versionId: string;
  versionName: string;
  status: 'Draft' | 'Ready' | 'Locked' | 'Archived';
  overrideFlag: boolean;
  metric: string;
  pivotYear: PivotYear;
  value: number | null;
}): GlobalCsvRow {
  return {
    page: params.page,
    section: 'kpi_ribbon',
    version_id: params.versionId,
    version_name: params.versionName,
    status: params.status,
    override_flag: params.overrideFlag,
    metric: params.metric,
    unit: getMetricUnit(params.metric),
    pivot_year: params.pivotYear,
    year: params.pivotYear, // KPI uses pivot_year as year
    row_key: params.metric,
    row_label: getMetricLabel(params.metric),
    value: params.value,
  };
}

/**
 * Create series row (time-series data point)
 */
export function createSeriesRow(params: {
  page: string;
  versionId: string;
  versionName: string;
  status: 'Draft' | 'Ready' | 'Locked' | 'Archived';
  overrideFlag: boolean;
  metric: string;
  year: Year;
  value: number | null;
}): GlobalCsvRow {
  const isPivotYear = (PIVOT_YEARS as readonly number[]).includes(params.year);
  
  return {
    page: params.page,
    section: 'series',
    version_id: params.versionId,
    version_name: params.versionName,
    status: params.status,
    override_flag: params.overrideFlag,
    metric: params.metric,
    unit: getMetricUnit(params.metric),
    pivot_year: isPivotYear ? (params.year as PivotYear) : '',
    year: params.year,
    row_key: params.metric,
    row_label: getMetricLabel(params.metric),
    value: params.value,
  };
}

/**
 * Create table row (statement line)
 */
export function createTableRow(params: {
  page: string;
  section: 'pnl_summary' | 'costs' | 'ratios';
  versionId: string;
  versionName: string;
  status: 'Draft' | 'Ready' | 'Locked' | 'Archived';
  overrideFlag: boolean;
  rowKey: string;
  rowLabel: string;
  pivotYear: PivotYear;
  value: number | null;
  unit?: string;
}): GlobalCsvRow {
  return {
    page: params.page,
    section: params.section,
    version_id: params.versionId,
    version_name: params.versionName,
    status: params.status,
    override_flag: params.overrideFlag,
    metric: params.rowKey,
    unit: params.unit || getMetricUnit(params.rowKey),
    pivot_year: params.pivotYear,
    year: params.pivotYear, // Table rows use pivot_year as year
    row_key: params.rowKey,
    row_label: params.rowLabel,
    value: params.value,
  };
}

/**
 * Download global CSV (browser-only)
 */
export function downloadGlobalCsv(rows: GlobalCsvRow[], filename?: string): void {
  if (typeof window === 'undefined') {
    throw new Error('downloadGlobalCsv can only be called in the browser');
  }

  const csvContent = generateGlobalCsv(rows);
  const finalFilename = filename || generateCsvFilename('export', 'global');

  // Create Blob with UTF-8 encoding
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

