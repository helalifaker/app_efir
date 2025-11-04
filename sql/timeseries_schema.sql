-- Time-Series Schema for EFIR
-- Run this AFTER schema.sql and rls_policies.sql
-- 
-- This adds:
-- 1. admin_config: JSONB for all admin params, versioned, auditable
-- 2. version_metrics: Time-series data (2023-2052) with is_historical flag
-- 3. version_computed: Cache for derived metrics

-- ============================================================================
-- 1. ADMIN_CONFIG TABLE (replaces/extends app_settings for time-series config)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.admin_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key text NOT NULL UNIQUE,
  config_value jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid, -- references auth.users(id)
  
  -- Audit trail (for versioning)
  previous_version jsonb,
  change_note text
);

CREATE INDEX IF NOT EXISTS idx_admin_config_key ON public.admin_config(config_key);
CREATE INDEX IF NOT EXISTS idx_admin_config_updated_at ON public.admin_config(updated_at DESC);

-- ============================================================================
-- 2. VERSION_METRICS TABLE (time-series data per version, per year, per metric)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.version_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year BETWEEN 2023 AND 2052),
  metric_key text NOT NULL,
  value numeric,
  is_historical boolean NOT NULL DEFAULT false, -- true for 2023-2024, false for 2025-2052
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique metric per version per year
  UNIQUE(version_id, year, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_version_metrics_version_id ON public.version_metrics(version_id);
CREATE INDEX IF NOT EXISTS idx_version_metrics_year ON public.version_metrics(year);
CREATE INDEX IF NOT EXISTS idx_version_metrics_version_year ON public.version_metrics(version_id, year);
CREATE INDEX IF NOT EXISTS idx_version_metrics_version_key ON public.version_metrics(version_id, metric_key);
CREATE INDEX IF NOT EXISTS idx_version_metrics_historical ON public.version_metrics(version_id, is_historical);

-- ============================================================================
-- 3. VERSION_COMPUTED TABLE (cache for derived/computed metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.version_computed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  computed_key text NOT NULL, -- e.g., 'cash_engine_pass_1', 'bs_balance_check'
  computed_value jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure unique computed key per version
  UNIQUE(version_id, computed_key)
);

CREATE INDEX IF NOT EXISTS idx_version_computed_version_id ON public.version_computed(version_id);
CREATE INDEX IF NOT EXISTS idx_version_computed_key ON public.version_computed(version_id, computed_key);
CREATE INDEX IF NOT EXISTS idx_version_computed_at ON public.version_computed(computed_at DESC);

-- ============================================================================
-- INITIAL ADMIN_CONFIG VALUES
-- ============================================================================
-- Seed default admin configuration (can be updated via API)
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

-- ============================================================================
-- HELPER FUNCTION: Mark historical years (2023-2024) as read-only
-- ============================================================================
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
-- DONE! Time-series schema created successfully.
-- ============================================================================
