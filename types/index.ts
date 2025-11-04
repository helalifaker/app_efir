// types/index.ts
// Locked Blueprint: Time-Series Types and Constants

// ============================================================================
// YEAR CONSTANTS
// ============================================================================
export const HISTORY_START = 2023;
export const FORECAST_END = 2052;
export const FORECAST_START = 2025;

// All years: 2023-2052 (30 years total)
export const YEARS: Year[] = Array.from({ length: 30 }, (_, i) => HISTORY_START + i) as Year[];

// Historical years (read-only): 2023-2024
export const HISTORY_YEARS = [2023, 2024] as const;

// Pivot years for reporting: [2024 (Last Historical), 2025, 2028, 2038, 2048, 2052]
export const PIVOT_YEARS = [2024, 2025, 2028, 2038, 2048, 2052] as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================
// Year type: 2023-2052 (validated via Zod in schemas)
// Using number for simplicity, validation happens at runtime via Zod
export type Year = number;
export type HistoryYear = (typeof HISTORY_YEARS)[number];
export type PivotYear = (typeof PIVOT_YEARS)[number];

// ============================================================================
// SERIES POINT (time-series data point with historical flag)
// ============================================================================
export interface SeriesPoint {
  year: Year;
  value: number | null;
  isHistorical: boolean; // true for 2023-2024, false for 2025-2052
}

// ============================================================================
// METRIC KEYS (locked blueprint keys)
// ============================================================================
export type MetricKey =
  // Revenue
  | 'revenue'
  | 'students_count'
  | 'avg_tuition_fee'
  | 'other_income'
  // P&L
  | 'cost_of_sales'
  | 'gross_profit'
  | 'operating_expenses'
  | 'ebitda'
  | 'depreciation'
  | 'ebit'
  | 'interest_income'
  | 'interest_expense'
  | 'net_income'
  // Balance Sheet
  | 'assets'
  | 'assets_current'
  | 'cash'
  | 'receivables'
  | 'assets_fixed'
  | 'liabilities'
  | 'liabilities_current'
  | 'debt'
  | 'equity'
  | 'retained_earnings'
  // Cash Flow
  | 'cf_operating'
  | 'cf_investing'
  | 'cf_financing'
  | 'cf_net_change'
  | 'cash_beginning'
  | 'cash_ending'
  // Provisions
  | 'provision_operational'
  | 'provision_contingency'
  // Other
  | 'capex_total'
  | 'rent_expense'
  | 'lease_expense';

// ============================================================================
// ADMIN CONFIG STRUCTURE
// ============================================================================
export interface AdminConfig {
  vat: { rate: number };
  fx: { baseCurrency: string; rates: Record<string, number> };
  cpi: { baseYear: number; rates: Record<string, number> };
  drivers: {
    2025?: Record<string, unknown>;
    2026?: Record<string, unknown>;
    2027?: Record<string, unknown>;
  };
  depreciation: { method: string; rates: Record<string, number> };
  rent_lease: { baseRent: number; escalationRate: number };
  validation: {
    thresholds: Record<string, number>;
    rules: Array<{ code: string; severity: 'critical' | 'major' | 'minor'; threshold?: number }>;
  };
  governance: { approvalRequired: boolean; maxVersions: number };
  npv: { discountRate: number };
  cashEngine: {
    maxIterations: number;
    tolerance: number;
    convergenceCheck: 'bs_cf_balance' | 'cash_balance';
    depositRate?: number; // e.g., 0.05 for 5%
    overdraftRate?: number; // e.g., 0.12 for 12%
    interestClassification?: 'Operating' | 'Investing' | 'Financing'; // Default: Operating
  };
}

// ============================================================================
// VERSION METRICS (database row structure)
// ============================================================================
export interface VersionMetric {
  id: string;
  version_id: string;
  year: Year;
  metric_key: string;
  value: number | null;
  is_historical: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// METRIC CATALOG (database row structure)
// ============================================================================
export interface MetricCatalogEntry {
  id: string;
  metric_key: string;
  display_name: string;
  unit: string;
  category: 'revenue' | 'pnl' | 'balance_sheet' | 'cash_flow' | 'provisions' | 'other';
  statement_type: 'pnl' | 'bs' | 'cf' | null;
  row_key: string | null;
  row_label: string | null;
  formula: string | null;
  is_calculated: boolean;
  is_historical: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// VERSION STATEMENT LINES (database row structure)
// ============================================================================
export interface VersionStatementLine {
  id: string;
  version_id: string;
  statement_type: 'pnl' | 'bs' | 'cf';
  row_key: string;
  row_label: string;
  display_order: number;
  parent_row_key: string | null;
  level: number;
  is_calculated: boolean;
  is_subtotal: boolean;
  formula: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// COMPUTED METRICS (cache structure)
// ============================================================================
export interface VersionComputed {
  id: string;
  version_id: string;
  computed_key: string;
  computed_value: Record<string, unknown>;
  computed_at: string;
}

// ============================================================================
// CONVERGENCE STATUS
// ============================================================================
export interface ConvergenceStatus {
  converged: boolean;
  iterations: number;
  maxIterations: number;
  tolerance: number;
  lastError?: number;
  checks: Array<{
    check: string;
    passed: boolean;
    value?: number;
    target?: number;
  }>;
}

// ============================================================================
// VALIDATION RESULT (per year)
// ============================================================================
export interface ValidationResult {
  year: Year;
  issues: Array<{
    code: string;
    message: string;
    severity: 'critical' | 'major' | 'minor';
    metric?: string;
    value?: number;
    threshold?: number;
  }>;
  passed: boolean;
  criticalCount: number;
  majorCount: number;
  minorCount: number;
}

// ============================================================================
// COMPARE PAYLOAD (for compare-v2 API)
// ============================================================================
export interface ComparePayload {
  left: {
    id: string;
    name: string;
    status: string;
    model_name: string;
  };
  right?: {
    id: string;
    name: string;
    status: string;
    model_name: string;
  };
  third?: {
    id: string;
    name: string;
    status: string;
    model_name: string;
  };
  baselineId: string;
  focusYear: Year;
  focusMetric?: MetricKey;
  pivotData: {
    year: PivotYear;
    metrics: Record<string, number | null>; // Primary version (left) metrics
    metricsByVersion?: Record<string, Record<string, number | null>>; // All versions' metrics
    deltas?: Record<string, { abs: number; pct: number }>; // Deltas vs baseline
    deltasByVersion?: Record<string, Record<string, { abs: number; pct: number }>>; // Deltas for all versions
  }[];
  kpis: {
    revenue?: number | null;
    ebitda?: number | null;
    ebitda_percent?: number | null;
    net_income?: number | null;
    cash?: number | null;
  };
  kpisByVersion?: Record<string, {
    revenue?: number | null;
    ebitda?: number | null;
    ebitda_percent?: number | null;
    net_income?: number | null;
    cash?: number | null;
  }>;
  milestones?: Array<{
    year: Year;
    label: string;
  }>;
  overrideFlags?: Record<string, boolean>;
}

// ============================================================================
// DASHBOARD PAYLOAD (for dashboard-v2 API)
// ============================================================================
export interface DashboardPayload {
  kpis: {
    totalModels: number;
    totalVersions: number;
    readyVersions: number;
    lockedVersions: number;
    draftVersions: number;
    alerts: number;
  };
  trends: {
    metric: MetricKey;
    series: SeriesPoint[];
  }[];
  heatmap: {
    versionId: string;
    versionName: string;
    years: Array<{
      year: Year;
      severity: 'critical' | 'major' | 'minor' | 'none';
      issueCount: number;
    }>;
  }[];
  statusMatrix: Array<{
    modelId: string;
    modelName: string;
    versionCount: number;
    latestStatus: string;
    latestUpdated: string;
  }>;
  alerts: Array<{
    versionId: string;
    versionName: string;
    issue: string;
    severity: 'critical' | 'major' | 'minor';
    year?: Year;
  }>;
  aggregates: {
    year: PivotYear;
    metrics: Record<string, number | null>;
  }[];
}

// ============================================================================
// VERSION STATUS (locked blueprint: capitalized)
// ============================================================================
export type VersionStatus = 'Draft' | 'Ready' | 'Locked' | 'Archived';

// ============================================================================
// ALERT SEVERITY (locked blueprint)
// ============================================================================
export type AlertSeverity = 'Critical' | 'Major' | 'Minor';

// ============================================================================
// HELPER TYPES
// ============================================================================
export type HistoricalSeries = SeriesPoint[]; // Only 2023-2024
export type ForecastSeries = SeriesPoint[]; // Only 2025-2052
export type FullSeries = SeriesPoint[]; // 2023-2052

// Type guard for historical years
export function isHistoricalYear(year: Year): year is HistoryYear {
  return year === 2023 || year === 2024;
}

// Type guard for pivot years
export function isPivotYear(year: Year): year is PivotYear {
  return (PIVOT_YEARS as readonly number[]).includes(year);
}

// Get all years in a range (inclusive)
export function getYearsInRange(start: Year, end: Year): Year[] {
  return YEARS.filter((y) => y >= start && y <= end);
}
