// lib/schemas/tabs.ts
// Canonical Zod schemas for all version tabs with TypeScript types

import { z } from 'zod';

// ============================================================================
// OVERVIEW TAB
// ============================================================================
export const overviewSchema = z.object({
  summary: z.string().optional(),
  description: z.string().optional(),
  period: z.string().optional(),
  fiscal_year: z.number().int().positive().optional(),
  notes: z.string().optional(),
}).passthrough(); // Allow additional fields

export type OverviewTab = z.infer<typeof overviewSchema>;

// ============================================================================
// PNL (Profit & Loss) TAB
// ============================================================================
export const pnlSchema = z.object({
  // Revenue
  revenue: z.number().optional(),
  students_count: z.number().int().nonnegative().optional(),
  avg_tuition_fee: z.number().nonnegative().optional(),
  other_income: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  
  // Costs
  cost_of_sales: z.number().optional(),
  operating_expenses: z.number().optional(),
  depreciation: z.number().optional(),
  amortization: z.number().optional(),
  
  // Profit metrics
  gross_profit: z.number().optional(),
  ebit: z.number().optional(), // Earnings Before Interest and Taxes
  ebitda: z.number().optional(), // Earnings Before Interest, Taxes, Depreciation, Amortization
  interest_expense: z.number().optional(),
  tax_expense: z.number().optional(),
  net_income: z.number().optional(),
  
  // Additional fields
  revenue_growth: z.number().optional(),
  margin_percentage: z.number().optional(),
}).passthrough();

export type PnlTab = z.infer<typeof pnlSchema>;

// ============================================================================
// BS (Balance Sheet) TAB
// ============================================================================
export const bsSchema = z.object({
  // Assets
  assets: z.number().optional(),
  assets_current: z.number().optional(),
  assets_fixed: z.number().optional(),
  cash: z.number().optional(),
  receivables: z.number().optional(),
  inventory: z.number().optional(),
  property: z.number().optional(),
  equipment: z.number().optional(),
  
  // Liabilities
  liabilities: z.number().optional(),
  liabilities_current: z.number().optional(),
  liabilities_long_term: z.number().optional(),
  
  // Equity
  equity: z.number().optional(),
  retained_earnings: z.number().optional(),
  share_capital: z.number().optional(),
}).passthrough();

export type BsTab = z.infer<typeof bsSchema>;

// ============================================================================
// CF (Cash Flow) TAB
// ============================================================================
export const cfSchema = z.object({
  // Operating activities
  operating: z.number().optional(),
  operating_cash_in: z.number().optional(),
  operating_cash_out: z.number().optional(),
  
  // Investing activities
  investing: z.number().optional(),
  investing_cash_in: z.number().optional(),
  investing_cash_out: z.number().optional(),
  
  // Financing activities
  financing: z.number().optional(),
  financing_cash_in: z.number().optional(),
  financing_cash_out: z.number().optional(),
  
  // Net change
  net_change: z.number().optional(),
  beginning_cash: z.number().optional(),
  ending_cash: z.number().optional(),
}).passthrough();

export type CfTab = z.infer<typeof cfSchema>;

// ============================================================================
// CAPEX TAB
// ============================================================================
export const capexSchema = z.object({
  projects: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    status: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
  })).optional(),
  total_capex: z.number().optional(),
  planned_capex: z.number().optional(),
  actual_capex: z.number().optional(),
}).passthrough();

export type CapexTab = z.infer<typeof capexSchema>;

// ============================================================================
// VALIDATION TAB
// ============================================================================
export const validationSchema = z.object({
  status: z.string().optional(),
  last_check: z.string().optional(),
  checks: z.array(z.object({
    name: z.string(),
    status: z.enum(['OK', 'WARNING', 'ERROR']),
    message: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
}).passthrough();

export type ValidationTab = z.infer<typeof validationSchema>;

// ============================================================================
// UNION TYPE FOR ALL TABS
// ============================================================================
export type TabData = AssumptionsTab | OverviewTab | PnlTab | BsTab | CfTab | CapexTab | ValidationTab;

export type TabType = 'assumptions' | 'overview' | 'pnl' | 'bs' | 'cf' | 'capex' | 'validation';

// ============================================================================
// SCHEMA MAPPER
// ============================================================================
// Assumptions schema (similar to overview, allows flexible data)
export const assumptionsSchema = z.object({
  assumptions: z.array(z.object({
    name: z.string(),
    value: z.union([z.string(), z.number()]),
    description: z.string().optional(),
  })).optional(),
  notes: z.string().optional(),
  key_assumptions: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
}).passthrough();

export type AssumptionsTab = z.infer<typeof assumptionsSchema>;

export const tabSchemas: Record<TabType, z.ZodSchema<unknown>> = {
  assumptions: assumptionsSchema,
  overview: overviewSchema,
  pnl: pnlSchema,
  bs: bsSchema,
  cf: cfSchema,
  capex: capexSchema,
  validation: validationSchema,
};

// Tab order constant for navigation
export const TAB_ORDER: TabType[] = ['overview', 'assumptions', 'pnl', 'bs', 'cf', 'capex', 'validation'];

/**
 * Validate tab data against its schema
 * Uses passthrough() so additional fields are allowed
 */
export function validateTabData(tab: TabType, data: unknown): { success: boolean; error?: z.ZodError } {
  const schema = tabSchemas[tab];
  if (!schema) {
    return { success: false, error: new z.ZodError([{
      code: 'custom',
      path: [],
      message: `Unknown tab type: ${tab}`,
    }]) };
  }
  
  // Use safeParse - passthrough() allows extra fields
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true };
  }
  
  // Only return validation errors for type mismatches, not missing optional fields
  // Filter out errors for optional fields that are undefined
  const filteredErrors = result.error.issues.filter(issue => {
    // Allow undefined for optional fields
    if (issue.code === 'invalid_type' && 'received' in issue && issue.received === 'undefined') {
      return false;
    }
    return true;
  });
  
  if (filteredErrors.length === 0) {
    return { success: true };
  }
  
  return { success: false, error: new z.ZodError(filteredErrors) };
}

