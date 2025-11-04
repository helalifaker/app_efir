-- Complete EFIR Migration Script
-- Run this in Supabase SQL Editor to set up the complete database
-- 
-- This script combines all necessary migrations in order:
-- 1. Base schema
-- 2. RLS policies
-- 3. Time-series schema
-- 4. Phase 1 status model
-- 5. Phase 2 data model
-- 6. Phase 2 RLS policies
--
-- Note: This is a combined script for convenience. If you prefer,
-- you can run each migration file separately in order.

-- ============================================================================
-- PART 1: BASE SCHEMA (from schema.sql)
-- ============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  role text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Models table
CREATE TABLE IF NOT EXISTS public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_models_name ON public.models(name);
CREATE INDEX IF NOT EXISTS idx_models_owner_id ON public.models(owner_id);

-- Model versions table (will be updated in Phase 1)
CREATE TABLE IF NOT EXISTS public.model_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  name text NOT NULL,
  status text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_versions_model_id ON public.model_versions(model_id);
CREATE INDEX IF NOT EXISTS idx_model_versions_status ON public.model_versions(status);
CREATE INDEX IF NOT EXISTS idx_model_versions_created_at ON public.model_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_versions_created_by ON public.model_versions(created_by);

-- Version tabs table
CREATE TABLE IF NOT EXISTS public.version_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  tab text NOT NULL CHECK (tab IN ('overview', 'pnl', 'bs', 'cf', 'capex', 'controls', 'assumptions')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, tab)
);

CREATE INDEX IF NOT EXISTS idx_version_tabs_version_id ON public.version_tabs(version_id);
CREATE INDEX IF NOT EXISTS idx_version_tabs_tab ON public.version_tabs(tab);

-- Version validations table
CREATE TABLE IF NOT EXISTS public.version_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  code text NOT NULL,
  message text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('error', 'warning', 'critical', 'major', 'minor')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_version_validations_version_id ON public.version_validations(version_id);
CREATE INDEX IF NOT EXISTS idx_version_validations_severity ON public.version_validations(severity);

-- Version status history table
CREATE TABLE IF NOT EXISTS public.version_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid,
  note text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vsh_version_id ON public.version_status_history(version_id);
CREATE INDEX IF NOT EXISTS idx_vsh_changed_at ON public.version_status_history(changed_at DESC);

-- App settings table
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated_at ON public.app_settings(updated_at DESC);

-- Seed default settings
INSERT INTO public.app_settings (key, value) VALUES
  ('vat', '{"rate": 0.15}'::jsonb),
  ('numberFormat', '{"locale": "en-US", "decimals": 2, "compact": false}'::jsonb),
  ('validation', '{"requireTabs": ["overview", "pnl", "bs", "cf"], "bsTolerance": 0.01}'::jsonb),
  ('ui', '{"currency": "SAR", "theme": "system"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- PART 2: TIME-SERIES SCHEMA (from timeseries_schema.sql)
-- ============================================================================

-- Admin config table
CREATE TABLE IF NOT EXISTS public.admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  previous_version jsonb,
  change_note text
);

CREATE INDEX IF NOT EXISTS idx_admin_config_key ON public.admin_config(config_key);
CREATE INDEX IF NOT EXISTS idx_admin_config_updated_at ON public.admin_config(updated_at DESC);

-- Version metrics table
CREATE TABLE IF NOT EXISTS public.version_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2023 AND 2052),
  metric_key text NOT NULL,
  value numeric,
  is_historical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, year, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_version_metrics_version_id ON public.version_metrics(version_id);
CREATE INDEX IF NOT EXISTS idx_version_metrics_year ON public.version_metrics(year);
CREATE INDEX IF NOT EXISTS idx_version_metrics_version_year ON public.version_metrics(version_id, year);
CREATE INDEX IF NOT EXISTS idx_version_metrics_version_key ON public.version_metrics(version_id, metric_key);
CREATE INDEX IF NOT EXISTS idx_version_metrics_historical ON public.version_metrics(version_id, is_historical);

-- Version computed table
CREATE TABLE IF NOT EXISTS public.version_computed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  computed_key text NOT NULL,
  computed_value jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, computed_key)
);

CREATE INDEX IF NOT EXISTS idx_version_computed_version_id ON public.version_computed(version_id);
CREATE INDEX IF NOT EXISTS idx_version_computed_key ON public.version_computed(version_id, computed_key);
CREATE INDEX IF NOT EXISTS idx_version_computed_at ON public.version_computed(computed_at DESC);

-- Seed admin config
INSERT INTO public.admin_config (config_key, config_value, change_note) VALUES
  ('vat', '{"rate": 0.15}'::jsonb, 'Initial VAT rate'),
  ('fx', '{"baseCurrency": "SAR", "rates": {}}'::jsonb, 'Initial FX config'),
  ('cpi', '{"baseYear": 2024, "rates": {}}'::jsonb, 'Initial CPI config'),
  ('drivers', '{"2025": {}, "2026": {}, "2027": {}}'::jsonb, 'Initial drivers (2025-2027)'),
  ('depreciation', '{"method": "straight_line", "rates": {}}'::jsonb, 'Initial depreciation config'),
  ('rent_lease', '{"baseRent": 0, "escalationRate": 0}'::jsonb, 'Initial rent/lease config'),
  ('validation', '{"thresholds": {}, "rules": []}'::jsonb, 'Initial validation rules'),
  ('governance', '{"approvalRequired": true, "maxVersions": 10}'::jsonb, 'Initial governance rules'),
  ('npv', '{"discountRate": 0.1}'::jsonb, 'Initial NPV discount rate'),
  ('cashEngine', '{"maxIterations": 3, "tolerance": 0.01, "convergenceCheck": "bs_cf_balance", "depositRate": 0.05, "overdraftRate": 0.12, "interestClassification": "Operating"}'::jsonb, 'Initial cash engine settings')
ON CONFLICT (config_key) DO NOTHING;

-- Helper function
CREATE OR REPLACE FUNCTION public.mark_historical_years(version_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE public.version_metrics
  SET is_historical = true
  WHERE version_id = version_id_param
    AND year IN (2023, 2024);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 3: PHASE 1 STATUS MODEL (from phase1_status_model.sql)
-- ============================================================================

-- Add new columns to model_versions (if not exist)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'public' 
                 AND table_name = 'model_versions' 
                 AND column_name = 'override_flag') THEN
    ALTER TABLE public.model_versions 
    ADD COLUMN override_flag boolean NOT NULL DEFAULT false,
    ADD COLUMN override_reason text,
    ADD COLUMN override_by uuid,
    ADD COLUMN archived_at timestamptz;
  END IF;
END $$;

-- Create version_audit table
CREATE TABLE IF NOT EXISTS public.version_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  transition_type text NOT NULL,
  changed_by uuid,
  changed_by_email text,
  reason text,
  override_flag boolean NOT NULL DEFAULT false,
  override_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_version_audit_version_id ON public.version_audit(version_id);
CREATE INDEX IF NOT EXISTS idx_version_audit_created_at ON public.version_audit(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_version_audit_version_status ON public.version_audit(version_id, new_status);

-- Fix existing status values (normalize to capitalized)
UPDATE public.model_versions
SET status = CASE 
  WHEN status = 'draft' THEN 'Draft'
  WHEN status = 'ready' THEN 'Ready'
  WHEN status = 'locked' THEN 'Locked'
  WHEN status = 'archived' THEN 'Archived'
  WHEN status = 'V1' OR status = 'v1' OR status NOT IN ('Draft', 'Ready', 'Locked', 'Archived') THEN 'Draft'
  ELSE status
END
WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived');

-- Update status history
UPDATE public.version_status_history
SET old_status = CASE 
  WHEN old_status = 'draft' THEN 'Draft'
  WHEN old_status = 'ready' THEN 'Ready'
  WHEN old_status = 'locked' THEN 'Locked'
  WHEN old_status = 'archived' THEN 'Archived'
  ELSE old_status
END,
new_status = CASE 
  WHEN new_status = 'draft' THEN 'Draft'
  WHEN new_status = 'ready' THEN 'Ready'
  WHEN new_status = 'locked' THEN 'Locked'
  WHEN new_status = 'archived' THEN 'Archived'
  ELSE new_status
END
WHERE old_status IS NOT NULL AND old_status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')
   OR new_status NOT IN ('Draft', 'Ready', 'Locked', 'Archived');

-- Drop old constraint if exists
ALTER TABLE public.model_versions DROP CONSTRAINT IF EXISTS model_versions_status_check;

-- Add new constraint with capitalized statuses
ALTER TABLE public.model_versions
ADD CONSTRAINT model_versions_status_check 
CHECK (status IN ('Draft', 'Ready', 'Locked', 'Archived'));

-- Update version_status_history constraint
ALTER TABLE public.version_status_history DROP CONSTRAINT IF EXISTS version_status_history_new_status_check;
ALTER TABLE public.version_status_history
ADD CONSTRAINT version_status_history_new_status_check 
CHECK (new_status IN ('Draft', 'Ready', 'Locked', 'Archived'));

ALTER TABLE public.version_status_history DROP CONSTRAINT IF EXISTS version_status_history_old_status_check;
ALTER TABLE public.version_status_history
ADD CONSTRAINT version_status_history_old_status_check 
CHECK (old_status IS NULL OR old_status IN ('Draft', 'Ready', 'Locked', 'Archived'));

-- Create transition validation function
CREATE OR REPLACE FUNCTION public.can_transition_status(
  version_id_param uuid,
  from_status text,
  to_status text,
  actor_is_admin boolean
)
RETURNS TABLE(allowed boolean, reason text) AS $$
DECLARE
  critical_count integer;
  current_status text;
BEGIN
  -- Get current status
  SELECT status INTO current_status
  FROM public.model_versions
  WHERE id = version_id_param;
  
  -- Validate current status matches
  IF current_status != from_status THEN
    RETURN QUERY SELECT false, 'Current status does not match expected status'::text;
    RETURN;
  END IF;
  
  -- Check critical validations for Draft -> Ready
  IF from_status = 'Draft' AND to_status = 'Ready' THEN
    SELECT COUNT(*) INTO critical_count
    FROM public.version_validations
    WHERE version_id = version_id_param
      AND severity IN ('critical', 'error');
    
    IF critical_count > 0 AND NOT actor_is_admin THEN
      RETURN QUERY SELECT false, format('Cannot transition: %s critical issue(s) found', critical_count)::text;
      RETURN;
    END IF;
  END IF;
  
  -- Admin-only transitions
  IF (to_status = 'Locked' OR to_status = 'Archived' OR (from_status = 'Locked' AND to_status = 'Draft')) THEN
    IF NOT actor_is_admin THEN
      RETURN QUERY SELECT false, 'This transition requires admin privileges'::text;
      RETURN;
    END IF;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT true, 'Transition allowed'::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_version_transition(
  version_id_param uuid,
  old_status text,
  new_status text,
  changed_by_param uuid,
  changed_by_email_param text,
  reason_param text,
  override_flag_param boolean DEFAULT false,
  override_reason_param text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  transition_type_val text;
  audit_id uuid;
BEGIN
  -- Determine transition type
  IF old_status IS NULL THEN
    transition_type_val := 'create';
  ELSIF new_status = 'Archived' THEN
    transition_type_val := 'archive';
  ELSIF old_status = 'Draft' AND new_status = 'Ready' THEN
    transition_type_val := 'promote';
  ELSIF old_status = 'Ready' AND new_status = 'Locked' THEN
    transition_type_val := 'lock';
  ELSIF old_status = 'Locked' AND new_status = 'Draft' THEN
    transition_type_val := 'reopen';
  ELSE
    transition_type_val := 'update';
  END IF;
  
  -- Insert audit record
  INSERT INTO public.version_audit (
    version_id,
    old_status,
    new_status,
    transition_type,
    changed_by,
    changed_by_email,
    reason,
    override_flag,
    override_reason
  ) VALUES (
    version_id_param,
    old_status,
    new_status,
    transition_type_val,
    changed_by_param,
    changed_by_email_param,
    reason_param,
    override_flag_param,
    override_reason_param
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 4: PHASE 2 DATA MODEL (from phase2_data_model.sql)
-- ============================================================================

-- Metric catalog table
CREATE TABLE IF NOT EXISTS public.metric_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  unit text NOT NULL DEFAULT '',
  category text NOT NULL,
  statement_type text,
  row_key text,
  row_label text,
  formula text,
  is_calculated boolean NOT NULL DEFAULT false,
  is_historical boolean NOT NULL DEFAULT false,
  display_order integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metric_catalog_key ON public.metric_catalog(metric_key);
CREATE INDEX IF NOT EXISTS idx_metric_catalog_category ON public.metric_catalog(category);
CREATE INDEX IF NOT EXISTS idx_metric_catalog_statement_type ON public.metric_catalog(statement_type);
CREATE INDEX IF NOT EXISTS idx_metric_catalog_display_order ON public.metric_catalog(display_order);

-- Version statement lines table
CREATE TABLE IF NOT EXISTS public.version_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  statement_type text NOT NULL CHECK (statement_type IN ('pnl', 'bs', 'cf')),
  row_key text NOT NULL,
  row_label text NOT NULL,
  display_order integer NOT NULL,
  parent_row_key text,
  level integer NOT NULL DEFAULT 0,
  is_calculated boolean NOT NULL DEFAULT false,
  is_subtotal boolean NOT NULL DEFAULT false,
  formula text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, statement_type, row_key)
);

CREATE INDEX IF NOT EXISTS idx_version_statement_lines_version_id ON public.version_statement_lines(version_id);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_statement_type ON public.version_statement_lines(statement_type);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_version_statement ON public.version_statement_lines(version_id, statement_type);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_display_order ON public.version_statement_lines(version_id, statement_type, display_order);
CREATE INDEX IF NOT EXISTS idx_version_statement_lines_parent ON public.version_statement_lines(version_id, statement_type, parent_row_key);

-- Seed metric catalog
INSERT INTO public.metric_catalog (metric_key, display_name, unit, category, statement_type, row_key, row_label, is_calculated, display_order) VALUES
  ('revenue', 'Revenue', 'SAR', 'revenue', 'pnl', 'revenue', 'Revenue', false, 1),
  ('students_count', 'Students Count', 'count', 'revenue', null, 'students_count', 'Students Count', false, null),
  ('avg_tuition_fee', 'Average Tuition Fee', 'SAR', 'revenue', null, 'avg_tuition_fee', 'Average Tuition Fee', false, null),
  ('other_income', 'Other Income', 'SAR', 'revenue', 'pnl', 'other_income', 'Other Income', false, 2),
  ('cost_of_sales', 'Cost of Sales', 'SAR', 'pnl', 'pnl', 'cost_of_sales', 'Cost of Sales', false, 3),
  ('gross_profit', 'Gross Profit', 'SAR', 'pnl', 'pnl', 'gross_profit', 'Gross Profit', true, 4),
  ('operating_expenses', 'Operating Expenses', 'SAR', 'pnl', 'pnl', 'operating_expenses', 'Operating Expenses', false, 5),
  ('ebitda', 'EBITDA', 'SAR', 'pnl', 'pnl', 'ebitda', 'EBITDA', true, 6),
  ('depreciation', 'Depreciation', 'SAR', 'pnl', 'pnl', 'depreciation', 'Depreciation', false, 7),
  ('ebit', 'EBIT', 'SAR', 'pnl', 'pnl', 'ebit', 'EBIT', true, 8),
  ('interest_income', 'Interest Income', 'SAR', 'pnl', 'pnl', 'interest_income', 'Interest Income', false, 9),
  ('interest_expense', 'Interest Expense', 'SAR', 'pnl', 'pnl', 'interest_expense', 'Interest Expense', false, 10),
  ('net_income', 'Net Income', 'SAR', 'pnl', 'pnl', 'net_income', 'Net Income', true, 11),
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
  ('cf_operating', 'Operating Cash Flow', 'SAR', 'cash_flow', 'cf', 'cf.operating', 'Operating Cash Flow', false, 22),
  ('cf_investing', 'Investing Cash Flow', 'SAR', 'cash_flow', 'cf', 'cf.investing', 'Investing Cash Flow', false, 23),
  ('cf_financing', 'Financing Cash Flow', 'SAR', 'cash_flow', 'cf', 'cf.financing', 'Financing Cash Flow', false, 24),
  ('cf_net_change', 'Net Cash Change', 'SAR', 'cash_flow', 'cf', 'cf.net_change', 'Net Cash Change', true, 25),
  ('cash_beginning', 'Beginning Cash', 'SAR', 'cash_flow', 'cf', 'cash.beginning', 'Beginning Cash', false, 26),
  ('cash_ending', 'Ending Cash', 'SAR', 'cash_flow', 'cf', 'cash.ending', 'Ending Cash', true, 27),
  ('provision_operational', 'Operational Provision', 'SAR', 'provisions', null, 'provision_operational', 'Operational Provision', true, null),
  ('provision_contingency', 'Contingency Provision', 'SAR', 'provisions', null, 'provision_contingency', 'Contingency Provision', true, null),
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

-- Update formulas
UPDATE public.metric_catalog SET formula = 'Revenue - Cost of Sales' WHERE metric_key = 'gross_profit';
UPDATE public.metric_catalog SET formula = 'Gross Profit - Operating Expenses' WHERE metric_key = 'ebitda';
UPDATE public.metric_catalog SET formula = 'EBITDA - Depreciation' WHERE metric_key = 'ebit';
UPDATE public.metric_catalog SET formula = 'EBIT + Interest Income - Interest Expense' WHERE metric_key = 'net_income';
UPDATE public.metric_catalog SET formula = 'Current Assets + Fixed Assets' WHERE metric_key = 'assets';
UPDATE public.metric_catalog SET formula = 'Assets - Liabilities' WHERE metric_key = 'equity';
UPDATE public.metric_catalog SET formula = 'Operating + Investing + Financing' WHERE metric_key = 'cf_net_change';
UPDATE public.metric_catalog SET formula = 'Beginning Cash + Net Cash Change' WHERE metric_key = 'cash_ending';

-- Helper functions
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
-- PART 5: PHASE 2 RLS POLICIES (from phase2_rls_policies.sql)
-- ============================================================================

-- Enable RLS on metric_catalog
ALTER TABLE public.metric_catalog ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read metric catalog" ON public.metric_catalog;
DROP POLICY IF EXISTS "Admins can manage metric catalog" ON public.metric_catalog;
DROP POLICY IF EXISTS "Service role can manage metric catalog" ON public.metric_catalog;

-- Public read access
CREATE POLICY "Anyone can read metric catalog"
  ON public.metric_catalog
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role write access
GRANT ALL ON public.metric_catalog TO service_role;

-- Enable RLS on version_statement_lines
ALTER TABLE public.version_statement_lines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view statement lines for their versions" ON public.version_statement_lines;
DROP POLICY IF EXISTS "Users can manage statement lines for their versions" ON public.version_statement_lines;

-- Inherit access from model_versions
CREATE POLICY "Users can view statement lines for their versions"
  ON public.version_statement_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON m.id = mv.model_id
      WHERE mv.id = version_statement_lines.version_id
      AND (
        m.owner_id = auth.uid()
        OR m.owner_id IS NULL
      )
    )
  );

CREATE POLICY "Users can manage statement lines for their versions"
  ON public.version_statement_lines
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON m.id = mv.model_id
      WHERE mv.id = version_statement_lines.version_id
      AND (
        m.owner_id = auth.uid()
        OR m.owner_id IS NULL
      )
    )
  );

-- Service role bypass
GRANT ALL ON public.version_statement_lines TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check all tables exist
DO $$
DECLARE
  table_count integer;
BEGIN
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'models', 'model_versions', 'version_tabs', 'version_validations',
      'version_status_history', 'version_audit', 'admin_config',
      'version_metrics', 'version_computed', 'metric_catalog',
      'version_statement_lines'
    );
  
  RAISE NOTICE 'Tables created: %', table_count;
  ASSERT table_count = 11, 'Expected 11 tables, found ' || table_count;
END $$;

-- Check metric catalog seeded
DO $$
DECLARE
  metric_count integer;
BEGIN
  SELECT COUNT(*) INTO metric_count FROM public.metric_catalog;
  RAISE NOTICE 'Metrics in catalog: %', metric_count;
  ASSERT metric_count >= 31, 'Expected at least 31 metrics, found ' || metric_count;
END $$;

-- ============================================================================
-- DONE! Complete migration applied successfully.
-- ============================================================================

