// lib/schemas/timeseries.ts
// Zod validation schemas for time-series API payloads

import { z } from 'zod';
import { FORECAST_START, FORECAST_END, HISTORY_START } from '../../types';

// ============================================================================
// YEAR VALIDATION
// ============================================================================
export const YearSchema = z.number().int().min(HISTORY_START).max(FORECAST_END);

export const HistoryYearSchema = z.union([
  z.literal(2023),
  z.literal(2024),
]);

export const ForecastYearSchema = z.number().int().min(FORECAST_START).max(FORECAST_END);

export const PivotYearSchema = z.union([
  z.literal(2024),
  z.literal(2025),
  z.literal(2028),
  z.literal(2038),
  z.literal(2048),
  z.literal(2052),
]);

// ============================================================================
// METRIC KEY VALIDATION
// ============================================================================
export const MetricKeySchema = z.enum([
  // Revenue
  'revenue',
  'students_count',
  'avg_tuition_fee',
  'other_income',
  // P&L
  'cost_of_sales',
  'gross_profit',
  'operating_expenses',
  'ebitda',
  'depreciation',
  'ebit',
  'interest_income',
  'interest_expense',
  'net_income',
  // Balance Sheet
  'assets',
  'assets_current',
  'cash',
  'receivables',
  'assets_fixed',
  'liabilities',
  'liabilities_current',
  'debt',
  'equity',
  'retained_earnings',
  // Cash Flow
  'cf_operating',
  'cf_investing',
  'cf_financing',
  'cf_net_change',
  'cash_beginning',
  'cash_ending',
  // Provisions
  'provision_operational',
  'provision_contingency',
  // Other
  'capex_total',
  'rent_expense',
  'lease_expense',
]);

// ============================================================================
// SERIES POINT SCHEMA
// ============================================================================
export const SeriesPointSchema = z.object({
  year: YearSchema,
  value: z.number().nullable(),
  isHistorical: z.boolean(),
});

// ============================================================================
// VERSION METRIC SCHEMA (for API requests)
// ============================================================================
export const VersionMetricSchema = z.object({
  version_id: z.string().uuid(),
  year: YearSchema,
  metric_key: z.string().min(1),
  value: z.number().nullable(),
  is_historical: z.boolean().default(false),
});

// ============================================================================
// BATCH METRIC UPDATE SCHEMA
// ============================================================================
export const BatchMetricUpdateSchema = z.object({
  version_id: z.string().uuid(),
  metrics: z.array(
    z.object({
      year: YearSchema,
      metric_key: z.string().min(1),
      value: z.number().nullable(),
    })
  ),
});

// ============================================================================
// ADMIN CONFIG SCHEMA
// ============================================================================
export const AdminConfigSchema = z.object({
  vat: z.object({
    rate: z.number().min(0).max(1),
  }),
  fx: z.object({
    baseCurrency: z.string().min(1),
    rates: z.record(z.string(), z.number()),
  }),
  cpi: z.object({
    baseYear: z.number().int().min(2020).max(2052),
    rates: z.record(z.string(), z.number()),
  }),
  drivers: z.object({
    '2025': z.record(z.string(), z.any()).optional(),
    '2026': z.record(z.string(), z.any()).optional(),
    '2027': z.record(z.string(), z.any()).optional(),
  }),
  depreciation: z.object({
    method: z.string(),
    rates: z.record(z.string(), z.number()),
  }),
  rent_lease: z.object({
    baseRent: z.number().min(0),
    escalationRate: z.number().min(0).max(1),
  }),
  validation: z.object({
    thresholds: z.record(z.string(), z.number()),
    rules: z.array(
      z.object({
        code: z.string(),
        severity: z.enum(['critical', 'major', 'minor']),
        threshold: z.number().optional(),
      })
    ),
  }),
  governance: z.object({
    approvalRequired: z.boolean(),
    maxVersions: z.number().int().min(1),
  }),
  npv: z.object({
    discountRate: z.number().min(0).max(1),
  }),
  cashEngine: z.object({
    maxIterations: z.number().int().min(1).max(10),
    tolerance: z.number().min(0),
    convergenceCheck: z.enum(['bs_cf_balance', 'cash_balance']),
    depositRate: z.number().min(0).max(1).optional(), // e.g., 0.05 for 5%
    overdraftRate: z.number().min(0).max(1).optional(), // e.g., 0.12 for 12%
    interestClassification: z.enum(['Operating', 'Investing', 'Financing']).optional().default('Operating'),
  }),
});

// Partial admin config (for PATCH requests)
export const PartialAdminConfigSchema = AdminConfigSchema.partial();

// ============================================================================
// GET SERIES QUERY PARAMS
// ============================================================================
export const GetSeriesQuerySchema = z.object({
  version_id: z.string().uuid(),
  metric_key: z.string().min(1),
  start_year: z.coerce.number().int().min(HISTORY_START).max(FORECAST_END).optional(),
  end_year: z.coerce.number().int().min(HISTORY_START).max(FORECAST_END).optional(),
  include_historical: z.coerce.boolean().optional().default(true),
  include_forecast: z.coerce.boolean().optional().default(true),
});

// ============================================================================
// COMPARE QUERY PARAMS
// ============================================================================
export const CompareQuerySchema = z.object({
  left: z.string().uuid(),
  right: z.string().uuid().optional(),
  third: z.string().uuid().optional(),
  baseline: z.string().uuid().optional(), // defaults to left
  focusYear: PivotYearSchema.optional(),
  metric: MetricKeySchema.optional(),
});

// ============================================================================
// DASHBOARD QUERY PARAMS
// ============================================================================
export const DashboardQuerySchema = z.object({
  year: YearSchema.optional(),
  metric: MetricKeySchema.optional(),
  status: z.enum(['Draft', 'Ready', 'Locked', 'Archived']).optional(), // Blueprint: capitalized statuses
  model_id: z.string().uuid().optional(),
});

// ============================================================================
// VALIDATION RESULT SCHEMA
// ============================================================================
export const ValidationIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.enum(['critical', 'major', 'minor']),
  metric: z.string().optional(),
  value: z.number().optional(),
  threshold: z.number().optional(),
});

export const ValidationResultSchema = z.object({
  year: YearSchema,
  issues: z.array(ValidationIssueSchema),
  passed: z.boolean(),
  criticalCount: z.number().int().min(0),
  majorCount: z.number().int().min(0),
  minorCount: z.number().int().min(0),
});

// ============================================================================
// CONVERGENCE STATUS SCHEMA
// ============================================================================
export const ConvergenceCheckSchema = z.object({
  check: z.string(),
  passed: z.boolean(),
  value: z.number().optional(),
  target: z.number().optional(),
});

export const ConvergenceStatusSchema = z.object({
  converged: z.boolean(),
  iterations: z.number().int().min(0),
  maxIterations: z.number().int().min(1),
  tolerance: z.number().min(0),
  lastError: z.number().optional(),
  checks: z.array(ConvergenceCheckSchema),
});

// ============================================================================
// TYPE EXPORTS (TypeScript types from schemas)
// ============================================================================
export type Year = z.infer<typeof YearSchema>;
export type MetricKey = z.infer<typeof MetricKeySchema>;
export type SeriesPoint = z.infer<typeof SeriesPointSchema>;
export type VersionMetric = z.infer<typeof VersionMetricSchema>;
export type BatchMetricUpdate = z.infer<typeof BatchMetricUpdateSchema>;
export type AdminConfig = z.infer<typeof AdminConfigSchema>;
export type PartialAdminConfig = z.infer<typeof PartialAdminConfigSchema>;
export type GetSeriesQuery = z.infer<typeof GetSeriesQuerySchema>;
export type CompareQuery = z.infer<typeof CompareQuerySchema>;
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type ConvergenceCheck = z.infer<typeof ConvergenceCheckSchema>;
export type ConvergenceStatus = z.infer<typeof ConvergenceStatusSchema>;
