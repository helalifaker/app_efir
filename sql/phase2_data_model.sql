-- Phase 2: Data Model Completion
-- Run this AFTER schema.sql, rls_policies.sql, and timeseries_schema.sql
--
-- This adds:
-- 1. metric_catalog: Catalog of all available metrics with metadata
-- 2. version_statement_lines: Structured statement line items

-- ============================================================================
-- 1. METRIC_CATALOG TABLE
-- ============================================================================
-- Central catalog of all metrics with metadata (display names, units, categories, formulas)
CREATE TABLE IF NOT EXISTS public.metric_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL UNIQUE, -- Canonical key (e.g., 'revenue', 'ebitda')
  display_name text NOT NULL, -- Human-readable name (e.g., 'Revenue', 'EBITDA')
  unit text NOT NULL DEFAULT '', -- Unit of measurement (e.g., 'SAR', '%', 'count', 'SAR/student')
  category text NOT NULL, -- Category: 'revenue', 'pnl', 'balance_sheet', 'cash_flow', 'provisions', 'other'
  statement_type text, -- Which statement: 'pnl', 'bs', 'cf', null for non-statement metrics
  row_key text, -- Row identifier in statements (e.g., 'revenue', 'assets.current.cash')
  row_label text, -- Human-readable row label for statements
  formula text, -- Optional formula description (e.g., 'Revenue - Cost of Sales')
  is_calculated boolean NOT NULL DEFAULT false, -- Whether this is a derived/calculated metric
  is_historical boolean NOT NULL DEFAULT false, -- Whether this applies to historical years only
  display_order integer, -- Order for display in statements/UI
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_catalog_key ON public.metric_catalog(metric_key);
CREATE INDEX IF NOT EXISTS idx_metric_catalog_category ON public.metric_catalog(category);
CREATE INDEX IF NOT EXISTS idx_metric_catalog_statement_type ON public.metric_catalog(statement_type);
CREATE INDEX IF NOT EXISTS idx_metric_catalog_display_order ON public.metric_catalog(display_order);

-- ============================================================================
-- 2. VERSION_STATEMENT_LINES TABLE
-- ============================================================================
-- Structured statement line items (replacing/supplementing JSONB in version_tabs)
-- This provides a normalized, queryable structure for financial statements
CREATE TABLE IF NOT EXISTS public.version_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  statement_type text NOT NULL CHECK (statement_type IN ('pnl', 'bs', 'cf')),
  row_key text NOT NULL, -- Canonical row identifier (e.g., 'revenue', 'assets.current.cash')
  row_label text NOT NULL, -- Human-readable label (e.g., 'Revenue', 'Cash')
  display_order integer NOT NULL, -- Order within the statement
  parent_row_key text, -- For hierarchical structure (e.g., 'assets.current' parent of 'assets.current.cash')
  level integer NOT NULL DEFAULT 0, -- Indentation level (0 = top level, 1 = sub-item, etc.)
  is_calculated boolean NOT NULL DEFAULT false, -- Whether this is a derived line
  is_subtotal boolean NOT NULL DEFAULT false, -- Whether this is a subtotal line
  formula text, -- Optional formula (e.g., 'Revenue - Cost of Sales')
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique row per version per statement
  UNIQUE(version_id, statement_type, row_key)
);

CREATE INDEX IF NOT EXISTS idx_version_statement_lines_version_id ON public.version_statement_lines(version_id);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_statement_type ON public.version_statement_lines(statement_type);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_version_statement ON public.version_statement_lines(version_id, statement_type);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_display_order ON public.version_statement_lines(version_id, statement_type, display_order);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_parent ON public.version_statement_lines(version_id, statement_type, parent_row_key);

-- ============================================================================
-- 3. SEED METRIC_CATALOG WITH ALL METRICS
-- ============================================================================
-- Insert all metrics from the MetricKey type with appropriate metadata

INSERT INTO public.metric_catalog (metric_key, display_name, unit, category, statement_type, row_key, row_label, is_calculated, display_order) VALUES
  -- Revenue metrics
  ('revenue', 'Revenue', 'SAR', 'revenue', 'pnl', 'revenue', 'Revenue', false, 1),
  ('students_count', 'Students Count', 'count', 'revenue', null, 'students_count', 'Students Count', false, null),
  ('avg_tuition_fee', 'Average Tuition Fee', 'SAR', 'revenue', null, 'avg_tuition_fee', 'Average Tuition Fee', false, null),
  ('other_income', 'Other Income', 'SAR', 'revenue', 'pnl', 'other_income', 'Other Income', false, 2),
  
  -- P&L metrics
  ('cost_of_sales', 'Cost of Sales', 'SAR', 'pnl', 'pnl', 'cost_of_sales', 'Cost of Sales', false, 3),
  ('gross_profit', 'Gross Profit', 'SAR', 'pnl', 'pnl', 'gross_profit', 'Gross Profit', true, 4),
  ('operating_expenses', 'Operating Expenses', 'SAR', 'pnl', 'pnl', 'operating_expenses', 'Operating Expenses', false, 5),
  ('ebitda', 'EBITDA', 'SAR', 'pnl', 'pnl', 'ebitda', 'EBITDA', true, 6),
  ('depreciation', 'Depreciation', 'SAR', 'pnl', 'pnl', 'depreciation', 'Depreciation', false, 7),
  ('ebit', 'EBIT', 'SAR', 'pnl', 'pnl', 'ebit', 'EBIT', true, 8),
  ('interest_income', 'Interest Income', 'SAR', 'pnl', 'pnl', 'interest_income', 'Interest Income', false, 9),
  ('interest_expense', 'Interest Expense', 'SAR', 'pnl', 'pnl', 'interest_expense', 'Interest Expense', false, 10),
  ('net_income', 'Net Income', 'SAR', 'pnl', 'pnl', 'net_income', 'Net Income', true, 11),
  
  -- Balance Sheet metrics
  ('assets', 'Total Assets', 'SAR', 'balance_sheet', 'bs', 'assets', 'Total Assets', true, 12),
  ('assets_current', 'Current Assets', 'SAR', 'balance_sheet', 'bs', 'assets.current', 'Current Assets', true, 13),
  ('cash', 'Cash', 'SAR', 'balance_sheet', 'bs', 'assets.current.cash', 'Cash', false, 14),
  ('receivables', 'Receivables', 'SAR', 'balance_sheet', 'bs', 'assets.current.receivables', 'Receivables', false, 15),
  ('assets_fixed', 'Fixed Assets', 'SAR', 'balance_sheet', 'bs', 'assets.fixed', 'Fixed Assets', false, 16),
  ('liabilities', 'Total Liabilities', 'SAR', 'balance_sheet', 'bs', 'liabilities', 'Total Liabilities', true, 17),
  ('liabilities_current', 'Current Liabilities', 'SAR', 'balance_sheet', 'bs', 'liabilities.current', 'Current Liabilities', false, 18),
  ('debt', 'Debt', 'SAR', 'balance_sheet', 'bs', 'liabilities.debt', 'Debt', false, 19),
  ('equity', 'Equity', 'SAR', 'balance_sheet', 'bs', 'equity', 'Equity', true, 20),
  ('retained_earnings', 'Retained Earnings', 'SAR', 'balance_sheet', 'bs', 'equity.retained_earnings', 'Retained Earnings', false, 21),
  
  -- Cash Flow metrics
  ('cf_operating', 'Operating Cash Flow', 'SAR', 'cash_flow', 'cf', 'cf.operating', 'Operating Cash Flow', false, 22),
  ('cf_investing', 'Investing Cash Flow', 'SAR', 'cash_flow', 'cf', 'cf.investing', 'Investing Cash Flow', false, 23),
  ('cf_financing', 'Financing Cash Flow', 'SAR', 'cash_flow', 'cf', 'cf.financing', 'Financing Cash Flow', false, 24),
  ('cf_net_change', 'Net Cash Change', 'SAR', 'cash_flow', 'cf', 'cf.net_change', 'Net Cash Change', true, 25),
  ('cash_beginning', 'Beginning Cash', 'SAR', 'cash_flow', 'cf', 'cash.beginning', 'Beginning Cash', false, 26),
  ('cash_ending', 'Ending Cash', 'SAR', 'cash_flow', 'cf', 'cash.ending', 'Ending Cash', true, 27),
  
  -- Provisions
  ('provision_operational', 'Operational Provision', 'SAR', 'provisions', null, 'provision_operational', 'Operational Provision', true, null),
  ('provision_contingency', 'Contingency Provision', 'SAR', 'provisions', null, 'provision_contingency', 'Contingency Provision', true, null),
  
  -- Other
  ('capex_total', 'Total CAPEX', 'SAR', 'other', null, 'capex_total', 'Total CAPEX', false, null),
  ('rent_expense', 'Rent Expense', 'SAR', 'other', null, 'rent_expense', 'Rent Expense', false, null),
  ('lease_expense', 'Lease Expense', 'SAR', 'other', null, 'lease_expense', 'Lease Expense', false, null)
ON CONFLICT (metric_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  unit = EXCLUDED.unit,
  category = EXCLUDED.category,
  statement_type = EXCLUDED.statement_type,
  row_key = EXCLUDED.row_key,
  row_label = EXCLUDED.row_label,
  is_calculated = EXCLUDED.is_calculated,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- Update formulas for calculated metrics
UPDATE public.metric_catalog SET
  formula = 'Revenue - Cost of Sales'
WHERE metric_key = 'gross_profit';

UPDATE public.metric_catalog SET
  formula = 'Gross Profit - Operating Expenses'
WHERE metric_key = 'ebitda';

UPDATE public.metric_catalog SET
  formula = 'EBITDA - Depreciation'
WHERE metric_key = 'ebit';

UPDATE public.metric_catalog SET
  formula = 'EBIT + Interest Income - Interest Expense'
WHERE metric_key = 'net_income';

UPDATE public.metric_catalog SET
  formula = 'Current Assets + Fixed Assets'
WHERE metric_key = 'assets';

UPDATE public.metric_catalog SET
  formula = 'Assets - Liabilities'
WHERE metric_key = 'equity';

UPDATE public.metric_catalog SET
  formula = 'Operating + Investing + Financing'
WHERE metric_key = 'cf_net_change';

UPDATE public.metric_catalog SET
  formula = 'Beginning Cash + Net Cash Change'
WHERE metric_key = 'cash_ending';

-- ============================================================================
-- 4. HELPER FUNCTIONS
-- ============================================================================

/**
 * Get metric metadata by key
 */
CREATE OR REPLACE FUNCTION public.get_metric_metadata(metric_key_param text)
RETURNS TABLE (
  metric_key text,
  display_name text,
  unit text,
  category text,
  statement_type text,
  row_key text,
  row_label text,
  formula text,
  is_calculated boolean,
  display_order integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.metric_key,
    mc.display_name,
    mc.unit,
    mc.category,
    mc.statement_type,
    mc.row_key,
    mc.row_label,
    mc.formula,
    mc.is_calculated,
    mc.display_order
  FROM public.metric_catalog mc
  WHERE mc.metric_key = metric_key_param;
END;
$$ LANGUAGE plpgsql STABLE;

/**
 * Get all metrics for a statement type
 */
CREATE OR REPLACE FUNCTION public.get_statement_metrics(statement_type_param text)
RETURNS TABLE (
  metric_key text,
  display_name text,
  unit text,
  row_key text,
  row_label text,
  is_calculated boolean,
  display_order integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mc.metric_key,
    mc.display_name,
    mc.unit,
    mc.row_key,
    mc.row_label,
    mc.is_calculated,
    mc.display_order
  FROM public.metric_catalog mc
  WHERE mc.statement_type = statement_type_param
  ORDER BY mc.display_order NULLS LAST, mc.metric_key;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 5. RLS POLICIES (will be added in separate script)
-- ============================================================================
-- Note: RLS policies for these tables will be added in phase2_rls_policies.sql

-- ============================================================================
-- DONE! Phase 2 data model created successfully.
-- ============================================================================

