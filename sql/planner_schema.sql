-- ============================================================================
-- EFIR Financial Planner - Database Schema Extension
-- ============================================================================
-- This extends the base schema with planning, forecasting, and collaboration features
-- Run this after schema.sql

-- ============================================================================
-- 1. SCENARIOS TABLE - Multiple scenarios per version
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('base', 'optimistic', 'pessimistic', 'custom')),
  description text,
  parent_scenario_id uuid REFERENCES public.scenarios(id) ON DELETE SET NULL,
  assumptions jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(version_id, name)
);

CREATE INDEX IF NOT EXISTS idx_scenarios_version_id ON public.scenarios(version_id);
CREATE INDEX IF NOT EXISTS idx_scenarios_type ON public.scenarios(type);
CREATE INDEX IF NOT EXISTS idx_scenarios_parent_id ON public.scenarios(parent_scenario_id);

-- Add scenario_id to version_tabs (nullable, defaults to base scenario)
ALTER TABLE public.version_tabs
ADD COLUMN IF NOT EXISTS scenario_id uuid REFERENCES public.scenarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_version_tabs_scenario_id ON public.version_tabs(scenario_id);

-- ============================================================================
-- 2. DRIVERS TABLE - Key business drivers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_name text NOT NULL,
  category text NOT NULL CHECK (category IN ('revenue', 'cost', 'growth', 'operational', 'financial', 'custom')),
  unit text, -- e.g., "students", "%", "SAR", "months"
  formula text, -- Formula for calculated drivers (e.g., "revenue / students_count")
  description text,
  is_global boolean DEFAULT false, -- Global drivers apply to all versions
  default_value numeric,
  min_value numeric,
  max_value numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_id, name)
);

CREATE INDEX IF NOT EXISTS idx_drivers_model_id ON public.drivers(model_id);
CREATE INDEX IF NOT EXISTS idx_drivers_category ON public.drivers(category);
CREATE INDEX IF NOT EXISTS idx_drivers_is_global ON public.drivers(is_global);

-- ============================================================================
-- 3. DRIVER_VALUES TABLE - Driver values by scenario and year
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.driver_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  scenario_id uuid NOT NULL REFERENCES public.scenarios(id) ON DELETE CASCADE,
  year integer NOT NULL CHECK (year >= 2023 AND year <= 2052),
  value numeric NOT NULL,
  source text CHECK (source IN ('manual', 'calculated', 'imported', 'forecasted')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(driver_id, scenario_id, year)
);

CREATE INDEX IF NOT EXISTS idx_driver_values_driver_id ON public.driver_values(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_values_scenario_id ON public.driver_values(scenario_id);
CREATE INDEX IF NOT EXISTS idx_driver_values_year ON public.driver_values(year);

-- ============================================================================
-- 4. BUDGETS TABLE - Budget tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  name text NOT NULL,
  fiscal_year integer NOT NULL,
  status text NOT NULL CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'archived')),
  description text,
  approved_by uuid,
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(model_id, fiscal_year, name)
);

CREATE INDEX IF NOT EXISTS idx_budgets_model_id ON public.budgets(model_id);
CREATE INDEX IF NOT EXISTS idx_budgets_fiscal_year ON public.budgets(fiscal_year);
CREATE INDEX IF NOT EXISTS idx_budgets_status ON public.budgets(status);

-- ============================================================================
-- 5. BUDGET_LINES TABLE - Budget line items
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id uuid NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category text NOT NULL, -- e.g., "Revenue", "Operating Expenses", "CapEx"
  subcategory text, -- e.g., "Tuition", "Salaries", "Equipment"
  metric_key text, -- Links to MetricKey from types/index.ts
  year integer NOT NULL CHECK (year >= 2023 AND year <= 2052),
  budgeted_value numeric NOT NULL,
  actual_value numeric,
  variance numeric GENERATED ALWAYS AS (actual_value - budgeted_value) STORED,
  variance_pct numeric GENERATED ALWAYS AS (
    CASE
      WHEN budgeted_value = 0 THEN NULL
      ELSE ((actual_value - budgeted_value) / budgeted_value) * 100
    END
  ) STORED,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(budget_id, category, subcategory, year)
);

CREATE INDEX IF NOT EXISTS idx_budget_lines_budget_id ON public.budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_year ON public.budget_lines(year);
CREATE INDEX IF NOT EXISTS idx_budget_lines_metric_key ON public.budget_lines(metric_key);

-- ============================================================================
-- 6. COMMENTS TABLE - Collaboration comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('version', 'scenario', 'driver', 'budget', 'assumption')),
  entity_id uuid NOT NULL,
  parent_comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE, -- For threaded comments
  user_id uuid NOT NULL,
  content text NOT NULL,
  mentions jsonb DEFAULT '[]'::jsonb, -- Array of user IDs mentioned
  resolved boolean DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_entity ON public.comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS idx_comments_resolved ON public.comments(resolved);

-- ============================================================================
-- 7. APPROVALS TABLE - Approval workflows
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('version', 'budget', 'scenario')),
  entity_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  approver_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  notes text,
  approver_notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  actioned_at timestamptz,
  UNIQUE(entity_type, entity_id, approver_id, status) -- Prevent duplicate pending approvals
);

CREATE INDEX IF NOT EXISTS idx_approvals_entity ON public.approvals(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approvals_approver_id ON public.approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON public.approvals(status);

-- ============================================================================
-- 8. SENSITIVITY_ANALYSES TABLE - What-if scenarios
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.sensitivity_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.model_versions(id) ON DELETE CASCADE,
  scenario_id uuid REFERENCES public.scenarios(id) ON DELETE CASCADE,
  name text NOT NULL,
  analysis_type text NOT NULL CHECK (analysis_type IN ('sensitivity', 'goal_seek', 'monte_carlo')),
  config jsonb NOT NULL, -- Configuration (variables, ranges, targets)
  results jsonb, -- Analysis results
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sensitivity_version_id ON public.sensitivity_analyses(version_id);
CREATE INDEX IF NOT EXISTS idx_sensitivity_scenario_id ON public.sensitivity_analyses(scenario_id);
CREATE INDEX IF NOT EXISTS idx_sensitivity_type ON public.sensitivity_analyses(analysis_type);

-- ============================================================================
-- 9. FORECAST_TEMPLATES TABLE - Reusable forecast templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.forecast_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text, -- e.g., "Education", "SaaS", "E-commerce"
  config jsonb NOT NULL, -- Template configuration (drivers, formulas, defaults)
  preview_data jsonb, -- Sample data for preview
  created_by uuid,
  is_public boolean DEFAULT false,
  use_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecast_templates_category ON public.forecast_templates(category);
CREATE INDEX IF NOT EXISTS idx_forecast_templates_is_public ON public.forecast_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_forecast_templates_use_count ON public.forecast_templates(use_count DESC);

-- ============================================================================
-- 10. CHANGE_LOG TABLE - Track changes for audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid,
  action text NOT NULL CHECK (action IN ('create', 'update', 'delete', 'clone', 'approve', 'reject')),
  changes jsonb, -- Diff of what changed
  metadata jsonb, -- Additional context
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_change_log_entity ON public.change_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_change_log_user_id ON public.change_log(user_id);
CREATE INDEX IF NOT EXISTS idx_change_log_created_at ON public.change_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_change_log_action ON public.change_log(action);

-- ============================================================================
-- 11. MODEL EXTENSIONS - Add template flag to models
-- ============================================================================
ALTER TABLE public.model_versions
ADD COLUMN IF NOT EXISTS is_template boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_model_versions_is_template ON public.model_versions(is_template);

-- ============================================================================
-- FUNCTIONS: Helper functions for common operations
-- ============================================================================

-- Function to auto-create base scenario when version is created
CREATE OR REPLACE FUNCTION create_base_scenario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.scenarios (version_id, name, type, description, created_by)
  VALUES (NEW.id, 'Base Scenario', 'base', 'Default base case scenario', NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_base_scenario
AFTER INSERT ON public.model_versions
FOR EACH ROW
EXECUTE FUNCTION create_base_scenario();

-- Function to log changes automatically
CREATE OR REPLACE FUNCTION log_changes()
RETURNS TRIGGER AS $$
DECLARE
  entity_type_var text;
  changes_var jsonb;
BEGIN
  entity_type_var := TG_TABLE_NAME;

  IF TG_OP = 'UPDATE' THEN
    changes_var := jsonb_build_object(
      'old', to_jsonb(OLD),
      'new', to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    changes_var := to_jsonb(OLD);
  ELSE
    changes_var := to_jsonb(NEW);
  END IF;

  INSERT INTO public.change_log (entity_type, entity_id, action, changes)
  VALUES (entity_type_var, NEW.id, lower(TG_OP), changes_var);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply change logging to key tables (uncomment to enable)
-- CREATE TRIGGER trigger_log_scenarios AFTER INSERT OR UPDATE OR DELETE ON public.scenarios FOR EACH ROW EXECUTE FUNCTION log_changes();
-- CREATE TRIGGER trigger_log_budgets AFTER INSERT OR UPDATE OR DELETE ON public.budgets FOR EACH ROW EXECUTE FUNCTION log_changes();

-- ============================================================================
-- DONE! Planner schema created successfully.
-- ============================================================================
-- Next steps:
-- 1. Run RLS policies (see planner_rls.sql)
-- 2. Seed sample data (see planner_seed.sql)
-- 3. Update application types (types/planner.ts)
