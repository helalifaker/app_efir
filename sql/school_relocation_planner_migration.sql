-- ============================================================================
-- School Relocation Planner - Database Migration
-- Version: 1.0
-- Date: 2025-11-13
-- ============================================================================
-- This script adds new tables to support School Relocation Planner features
-- Run this AFTER the base schema.sql
-- ============================================================================

-- ============================================================================
-- 1. CURRICULUM_PLAN TABLE
-- ============================================================================
-- Stores dual-curriculum planning data (French & IB)
-- One row per version, curriculum type, and year

CREATE TABLE IF NOT EXISTS public.curriculum_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  curriculum_type TEXT NOT NULL CHECK (curriculum_type IN ('FR', 'IB')),
  year INTEGER NOT NULL CHECK (year >= 2023 AND year <= 2052),
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  students INTEGER NOT NULL CHECK (students >= 0 AND students <= capacity),
  tuition DECIMAL(12, 2) NOT NULL CHECK (tuition > 0),
  teacher_ratio DECIMAL(5, 4) NOT NULL CHECK (teacher_ratio > 0 AND teacher_ratio < 1),
  non_teacher_ratio DECIMAL(5, 4) NOT NULL CHECK (non_teacher_ratio > 0 AND non_teacher_ratio < 1),
  cpi_frequency INTEGER NOT NULL CHECK (cpi_frequency IN (1, 2, 3)),
  cpi_base_year INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_curriculum_year UNIQUE (version_id, curriculum_type, year)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_plan_version ON public.curriculum_plan(version_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_plan_type_year ON public.curriculum_plan(curriculum_type, year);
CREATE INDEX IF NOT EXISTS idx_curriculum_plan_year ON public.curriculum_plan(year);

COMMENT ON TABLE public.curriculum_plan IS 'Dual-curriculum planning data (French & IB)';
COMMENT ON COLUMN public.curriculum_plan.curriculum_type IS 'FR = French, IB = International Baccalaureate';
COMMENT ON COLUMN public.curriculum_plan.capacity IS 'Maximum student capacity for this curriculum';
COMMENT ON COLUMN public.curriculum_plan.students IS 'Actual enrolled students (must be <= capacity)';
COMMENT ON COLUMN public.curriculum_plan.tuition IS 'Base tuition fee per student (before CPI adjustments)';
COMMENT ON COLUMN public.curriculum_plan.teacher_ratio IS 'Teachers per student (e.g., 0.15 = 1 teacher per 6.67 students)';
COMMENT ON COLUMN public.curriculum_plan.non_teacher_ratio IS 'Non-teaching staff per student';
COMMENT ON COLUMN public.curriculum_plan.cpi_frequency IS 'Years between tuition CPI adjustments (1, 2, or 3)';
COMMENT ON COLUMN public.curriculum_plan.cpi_base_year IS 'Base year for CPI calculations';

-- ============================================================================
-- 2. RENT_PLAN TABLE
-- ============================================================================
-- Stores rent configuration and calculations per year
-- Supports three rent models: FixedEscalation, RevenueShare, PartnerModel

CREATE TABLE IF NOT EXISTS public.rent_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  year INTEGER NOT NULL CHECK (year >= 2023 AND year <= 2052),
  model_type TEXT CHECK (model_type IN ('FixedEscalation', 'RevenueShare', 'PartnerModel')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  model_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_rent_year UNIQUE (version_id, year)
);

CREATE INDEX IF NOT EXISTS idx_rent_plan_version ON public.rent_plan(version_id);
CREATE INDEX IF NOT EXISTS idx_rent_plan_year ON public.rent_plan(year);
CREATE INDEX IF NOT EXISTS idx_rent_plan_model_type ON public.rent_plan(model_type);

COMMENT ON TABLE public.rent_plan IS 'Rent planning with three models: FixedEscalation, RevenueShare, PartnerModel';
COMMENT ON COLUMN public.rent_plan.model_type IS 'NULL for transition years (2025-2027), set for 2028+';
COMMENT ON COLUMN public.rent_plan.amount IS 'Calculated rent amount for this year';
COMMENT ON COLUMN public.rent_plan.model_config IS 'Model-specific parameters stored as JSONB';

-- ============================================================================
-- 3. CAPEX_RULE TABLE (Admin-managed)
-- ============================================================================
-- Stores capex reinvestment rules by asset class
-- Admin configures these rules, system applies them automatically

CREATE TABLE IF NOT EXISTS public.capex_rule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class TEXT NOT NULL CHECK (class IN ('Building', 'FF&E', 'IT', 'Other')),
  cycle_years INTEGER NOT NULL CHECK (cycle_years > 0),
  inflation_index TEXT NOT NULL,
  base_cost DECIMAL(12, 2) NOT NULL CHECK (base_cost > 0),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('cycle', 'utilization', 'both')) DEFAULT 'cycle',
  utilization_threshold DECIMAL(5, 2) CHECK (utilization_threshold >= 0 AND utilization_threshold <= 100),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capex_rule_class ON public.capex_rule(class);
CREATE INDEX IF NOT EXISTS idx_capex_rule_created_by ON public.capex_rule(created_by);

COMMENT ON TABLE public.capex_rule IS 'Admin-configured capex reinvestment rules by asset class';
COMMENT ON COLUMN public.capex_rule.class IS 'Asset class: Building (20y), FF&E (7y), IT (4y), Other (custom)';
COMMENT ON COLUMN public.capex_rule.cycle_years IS 'Reinvestment cycle in years';
COMMENT ON COLUMN public.capex_rule.inflation_index IS 'CPI index for cost escalation';
COMMENT ON COLUMN public.capex_rule.base_cost IS 'Base cost for reinvestment (inflated over time)';
COMMENT ON COLUMN public.capex_rule.trigger_type IS 'When to trigger: cycle (time-based), utilization (usage-based), or both';
COMMENT ON COLUMN public.capex_rule.utilization_threshold IS 'Optional: trigger when utilization exceeds this %';

-- ============================================================================
-- 4. OPEX_PLAN TABLE
-- ============================================================================
-- Stores opex structure as % of revenue
-- Can be single % or broken into sub-accounts

CREATE TABLE IF NOT EXISTS public.opex_plan (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  sub_account TEXT,
  pct_of_revenue DECIMAL(5, 2) NOT NULL CHECK (pct_of_revenue >= 0 AND pct_of_revenue <= 100),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opex_plan_version ON public.opex_plan(version_id);
CREATE INDEX IF NOT EXISTS idx_opex_plan_sub_account ON public.opex_plan(sub_account);

COMMENT ON TABLE public.opex_plan IS 'Opex structure as % of revenue, optional sub-accounts';
COMMENT ON COLUMN public.opex_plan.sub_account IS 'NULL for single opex %, or sub-account name';
COMMENT ON COLUMN public.opex_plan.pct_of_revenue IS 'Percentage of revenue (must sum to 100% if sub-accounts exist)';
COMMENT ON COLUMN public.opex_plan.amount IS 'Calculated opex amount (Revenue × pct_of_revenue)';

-- ============================================================================
-- 5. TUITION_SIMULATION TABLE
-- ============================================================================
-- Stores tuition simulation results
-- Rent-driven simulations to maintain target EBITDA

CREATE TABLE IF NOT EXISTS public.tuition_simulation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  rent_model_type TEXT NOT NULL CHECK (rent_model_type IN ('FixedEscalation', 'RevenueShare', 'PartnerModel')),
  adjustment_factor_fr DECIMAL(5, 2) NOT NULL CHECK (adjustment_factor_fr >= -20 AND adjustment_factor_fr <= 50),
  adjustment_factor_ib DECIMAL(5, 2) NOT NULL CHECK (adjustment_factor_ib >= -20 AND adjustment_factor_ib <= 50),
  target_margin DECIMAL(5, 2),
  target_ebitda DECIMAL(12, 2),
  results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tuition_sim_version ON public.tuition_simulation(version_id);
CREATE INDEX IF NOT EXISTS idx_tuition_sim_created ON public.tuition_simulation(created_at DESC);

COMMENT ON TABLE public.tuition_simulation IS 'Tuition simulation results (rent-driven)';
COMMENT ON COLUMN public.tuition_simulation.rent_model_type IS 'Rent model used in this simulation';
COMMENT ON COLUMN public.tuition_simulation.adjustment_factor_fr IS 'Tuition adjustment % for French curriculum (-20% to +50%)';
COMMENT ON COLUMN public.tuition_simulation.adjustment_factor_ib IS 'Tuition adjustment % for IB curriculum (-20% to +50%)';
COMMENT ON COLUMN public.tuition_simulation.target_margin IS 'Target EBITDA margin % (optional)';
COMMENT ON COLUMN public.tuition_simulation.target_ebitda IS 'Target EBITDA absolute amount (optional)';
COMMENT ON COLUMN public.tuition_simulation.results IS 'Year-by-year simulation results (JSONB)';

-- ============================================================================
-- 6. UPDATE APP_SETTINGS
-- ============================================================================
-- Add new financial parameters for School Relocation Planner

INSERT INTO public.app_settings (key, value) VALUES
  ('financial_statement', '{
    "dso_days": 30,
    "dpo_days": 45,
    "deferred_revenue_pct": 0.35
  }'::jsonb),
  ('teacher_salary', '{
    "fr_base": 120000,
    "ib_base": 150000,
    "cpi_adjustment": true
  }'::jsonb),
  ('non_teacher_salary', '{
    "fr_base": 80000,
    "ib_base": 90000,
    "cpi_adjustment": true
  }'::jsonb)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = now();

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE public.curriculum_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capex_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opex_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tuition_simulation ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Run sql/srp_rls_policies.sql to add RLS policies
-- 2. Run sql/srp_seed.sql to add test data (optional)
-- ============================================================================
