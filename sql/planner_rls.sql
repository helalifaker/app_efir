-- ============================================================================
-- EFIR Financial Planner - Row Level Security Policies
-- ============================================================================
-- Run this after planner_schema.sql

-- Enable RLS on all planner tables
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sensitivity_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 1. SCENARIOS POLICIES
-- ============================================================================

-- Users can view scenarios for versions they have access to
CREATE POLICY "Users can view scenarios"
ON public.scenarios FOR SELECT
USING (
  version_id IN (
    SELECT mv.id FROM public.model_versions mv
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can create scenarios for their own versions
CREATE POLICY "Users can create scenarios"
ON public.scenarios FOR INSERT
WITH CHECK (
  version_id IN (
    SELECT mv.id FROM public.model_versions mv
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can update scenarios for their own versions
CREATE POLICY "Users can update scenarios"
ON public.scenarios FOR UPDATE
USING (
  version_id IN (
    SELECT mv.id FROM public.model_versions mv
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can delete scenarios for their own versions (except base scenario)
CREATE POLICY "Users can delete scenarios"
ON public.scenarios FOR DELETE
USING (
  type != 'base' AND
  version_id IN (
    SELECT mv.id FROM public.model_versions mv
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- ============================================================================
-- 2. DRIVERS POLICIES
-- ============================================================================

-- Users can view drivers for their models
CREATE POLICY "Users can view drivers"
ON public.drivers FOR SELECT
USING (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  ) OR is_global = true
);

-- Users can create drivers for their models
CREATE POLICY "Users can create drivers"
ON public.drivers FOR INSERT
WITH CHECK (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  )
);

-- Users can update drivers for their models
CREATE POLICY "Users can update drivers"
ON public.drivers FOR UPDATE
USING (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  )
);

-- Users can delete drivers for their models
CREATE POLICY "Users can delete drivers"
ON public.drivers FOR DELETE
USING (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  )
);

-- ============================================================================
-- 3. DRIVER_VALUES POLICIES
-- ============================================================================

-- Users can view driver values for accessible scenarios
CREATE POLICY "Users can view driver values"
ON public.driver_values FOR SELECT
USING (
  scenario_id IN (
    SELECT s.id FROM public.scenarios s
    JOIN public.model_versions mv ON mv.id = s.version_id
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can create driver values for accessible scenarios
CREATE POLICY "Users can create driver values"
ON public.driver_values FOR INSERT
WITH CHECK (
  scenario_id IN (
    SELECT s.id FROM public.scenarios s
    JOIN public.model_versions mv ON mv.id = s.version_id
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can update driver values for accessible scenarios
CREATE POLICY "Users can update driver values"
ON public.driver_values FOR UPDATE
USING (
  scenario_id IN (
    SELECT s.id FROM public.scenarios s
    JOIN public.model_versions mv ON mv.id = s.version_id
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can delete driver values for accessible scenarios
CREATE POLICY "Users can delete driver values"
ON public.driver_values FOR DELETE
USING (
  scenario_id IN (
    SELECT s.id FROM public.scenarios s
    JOIN public.model_versions mv ON mv.id = s.version_id
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- ============================================================================
-- 4. BUDGETS POLICIES
-- ============================================================================

-- Users can view budgets for their models
CREATE POLICY "Users can view budgets"
ON public.budgets FOR SELECT
USING (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  )
);

-- Users can create budgets for their models
CREATE POLICY "Users can create budgets"
ON public.budgets FOR INSERT
WITH CHECK (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  )
);

-- Users can update budgets for their models
CREATE POLICY "Users can update budgets"
ON public.budgets FOR UPDATE
USING (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  )
);

-- Users can delete budgets for their models
CREATE POLICY "Users can delete budgets"
ON public.budgets FOR DELETE
USING (
  model_id IN (
    SELECT id FROM public.models WHERE owner_id = auth.uid() OR owner_id IS NULL
  )
);

-- ============================================================================
-- 5. BUDGET_LINES POLICIES
-- ============================================================================

-- Users can view budget lines for accessible budgets
CREATE POLICY "Users can view budget lines"
ON public.budget_lines FOR SELECT
USING (
  budget_id IN (
    SELECT b.id FROM public.budgets b
    JOIN public.models m ON m.id = b.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can manage budget lines (insert, update, delete)
CREATE POLICY "Users can create budget lines"
ON public.budget_lines FOR INSERT
WITH CHECK (
  budget_id IN (
    SELECT b.id FROM public.budgets b
    JOIN public.models m ON m.id = b.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

CREATE POLICY "Users can update budget lines"
ON public.budget_lines FOR UPDATE
USING (
  budget_id IN (
    SELECT b.id FROM public.budgets b
    JOIN public.models m ON m.id = b.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

CREATE POLICY "Users can delete budget lines"
ON public.budget_lines FOR DELETE
USING (
  budget_id IN (
    SELECT b.id FROM public.budgets b
    JOIN public.models m ON m.id = b.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- ============================================================================
-- 6. COMMENTS POLICIES
-- ============================================================================

-- Users can view all comments on entities they have access to
CREATE POLICY "Users can view comments"
ON public.comments FOR SELECT
USING (true); -- Simplified - check entity access in application layer

-- Users can create comments
CREATE POLICY "Users can create comments"
ON public.comments FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own comments
CREATE POLICY "Users can update own comments"
ON public.comments FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
ON public.comments FOR DELETE
USING (user_id = auth.uid());

-- ============================================================================
-- 7. APPROVALS POLICIES
-- ============================================================================

-- Users can view approvals they requested or are assigned to
CREATE POLICY "Users can view approvals"
ON public.approvals FOR SELECT
USING (requester_id = auth.uid() OR approver_id = auth.uid());

-- Users can create approval requests
CREATE POLICY "Users can create approvals"
ON public.approvals FOR INSERT
WITH CHECK (requester_id = auth.uid());

-- Users can update approvals they are assigned to
CREATE POLICY "Users can update approvals"
ON public.approvals FOR UPDATE
USING (approver_id = auth.uid());

-- ============================================================================
-- 8. SENSITIVITY_ANALYSES POLICIES
-- ============================================================================

-- Users can view sensitivity analyses for accessible versions
CREATE POLICY "Users can view sensitivity analyses"
ON public.sensitivity_analyses FOR SELECT
USING (
  version_id IN (
    SELECT mv.id FROM public.model_versions mv
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can create sensitivity analyses
CREATE POLICY "Users can create sensitivity analyses"
ON public.sensitivity_analyses FOR INSERT
WITH CHECK (
  version_id IN (
    SELECT mv.id FROM public.model_versions mv
    JOIN public.models m ON m.id = mv.model_id
    WHERE m.owner_id = auth.uid() OR m.owner_id IS NULL
  )
);

-- Users can delete their own analyses
CREATE POLICY "Users can delete sensitivity analyses"
ON public.sensitivity_analyses FOR DELETE
USING (created_by = auth.uid());

-- ============================================================================
-- 9. FORECAST_TEMPLATES POLICIES
-- ============================================================================

-- Users can view public templates or their own templates
CREATE POLICY "Users can view forecast templates"
ON public.forecast_templates FOR SELECT
USING (is_public = true OR created_by = auth.uid());

-- Users can create templates
CREATE POLICY "Users can create forecast templates"
ON public.forecast_templates FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Users can update their own templates
CREATE POLICY "Users can update forecast templates"
ON public.forecast_templates FOR UPDATE
USING (created_by = auth.uid());

-- Users can delete their own templates
CREATE POLICY "Users can delete forecast templates"
ON public.forecast_templates FOR DELETE
USING (created_by = auth.uid());

-- ============================================================================
-- 10. CHANGE_LOG POLICIES
-- ============================================================================

-- Users can view change logs for entities they have access to
CREATE POLICY "Users can view change logs"
ON public.change_log FOR SELECT
USING (true); -- Simplified - filter in application layer

-- System can insert change logs (no direct user INSERT)
-- Change logs are typically inserted by triggers or application code

-- ============================================================================
-- DONE! RLS policies configured successfully.
-- ============================================================================
