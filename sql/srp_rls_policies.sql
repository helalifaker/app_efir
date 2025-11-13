-- ============================================================================
-- School Relocation Planner - RLS Policies
-- Version: 1.0
-- Date: 2025-11-13
-- ============================================================================
-- Row Level Security policies for School Relocation Planner tables
-- Run this AFTER school_relocation_planner_migration.sql
-- ============================================================================

-- ============================================================================
-- 1. CURRICULUM_PLAN POLICIES
-- ============================================================================

-- Allow users to read curriculum_plan for versions they own
CREATE POLICY "Users can read own curriculum plans" ON public.curriculum_plan
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = curriculum_plan.version_id
      AND (mv.created_by = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- Allow users to insert curriculum_plan for their versions
CREATE POLICY "Users can create curriculum plans" ON public.curriculum_plan
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = curriculum_plan.version_id
      AND mv.created_by = auth.uid()
    )
  );

-- Allow users to update their curriculum plans
CREATE POLICY "Users can update own curriculum plans" ON public.curriculum_plan
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = curriculum_plan.version_id
      AND mv.created_by = auth.uid()
      AND mv.status IN ('Draft', 'Ready')
    )
  );

-- Allow users to delete their curriculum plans (Draft/Ready only)
CREATE POLICY "Users can delete own curriculum plans" ON public.curriculum_plan
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = curriculum_plan.version_id
      AND mv.created_by = auth.uid()
      AND mv.status IN ('Draft', 'Ready')
    )
  );

-- ============================================================================
-- 2. RENT_PLAN POLICIES
-- ============================================================================

-- Allow users to read rent_plan for versions they own
CREATE POLICY "Users can read own rent plans" ON public.rent_plan
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = rent_plan.version_id
      AND (mv.created_by = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- Allow users to insert rent_plan for their versions
CREATE POLICY "Users can create rent plans" ON public.rent_plan
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = rent_plan.version_id
      AND mv.created_by = auth.uid()
    )
  );

-- Allow users to update their rent plans
CREATE POLICY "Users can update own rent plans" ON public.rent_plan
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = rent_plan.version_id
      AND mv.created_by = auth.uid()
      AND mv.status IN ('Draft', 'Ready')
    )
  );

-- Allow users to delete their rent plans (Draft/Ready only)
CREATE POLICY "Users can delete own rent plans" ON public.rent_plan
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = rent_plan.version_id
      AND mv.created_by = auth.uid()
      AND mv.status IN ('Draft', 'Ready')
    )
  );

-- ============================================================================
-- 3. CAPEX_RULE POLICIES (Admin-only)
-- ============================================================================

-- Everyone can read capex rules (used by all versions)
CREATE POLICY "Everyone can read capex rules" ON public.capex_rule
  FOR SELECT USING (true);

-- Only authenticated users can create capex rules
-- (In practice, restrict this to Admin role via application logic)
CREATE POLICY "Authenticated users can create capex rules" ON public.capex_rule
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only rule creators can update their rules
CREATE POLICY "Users can update own capex rules" ON public.capex_rule
  FOR UPDATE USING (created_by = auth.uid());

-- Only rule creators can delete their rules
CREATE POLICY "Users can delete own capex rules" ON public.capex_rule
  FOR DELETE USING (created_by = auth.uid());

-- ============================================================================
-- 4. OPEX_PLAN POLICIES
-- ============================================================================

-- Allow users to read opex_plan for versions they own
CREATE POLICY "Users can read own opex plans" ON public.opex_plan
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = opex_plan.version_id
      AND (mv.created_by = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- Allow users to insert opex_plan for their versions
CREATE POLICY "Users can create opex plans" ON public.opex_plan
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = opex_plan.version_id
      AND mv.created_by = auth.uid()
    )
  );

-- Allow users to update their opex plans
CREATE POLICY "Users can update own opex plans" ON public.opex_plan
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = opex_plan.version_id
      AND mv.created_by = auth.uid()
      AND mv.status IN ('Draft', 'Ready')
    )
  );

-- Allow users to delete their opex plans (Draft/Ready only)
CREATE POLICY "Users can delete own opex plans" ON public.opex_plan
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = opex_plan.version_id
      AND mv.created_by = auth.uid()
      AND mv.status IN ('Draft', 'Ready')
    )
  );

-- ============================================================================
-- 5. TUITION_SIMULATION POLICIES
-- ============================================================================

-- Allow users to read tuition simulations for versions they own
CREATE POLICY "Users can read own tuition simulations" ON public.tuition_simulation
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = tuition_simulation.version_id
      AND (mv.created_by = auth.uid() OR auth.uid() IS NULL)
    )
  );

-- Allow users to insert tuition simulations for their versions
CREATE POLICY "Users can create tuition simulations" ON public.tuition_simulation
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = tuition_simulation.version_id
      AND mv.created_by = auth.uid()
    )
  );

-- Allow users to delete their tuition simulations (any status)
CREATE POLICY "Users can delete own tuition simulations" ON public.tuition_simulation
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      WHERE mv.id = tuition_simulation.version_id
      AND mv.created_by = auth.uid()
    )
  );

-- Note: No UPDATE policy for tuition_simulation (immutable records)

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify all policies are created:
/*
SELECT tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('curriculum_plan', 'rent_plan', 'capex_rule', 'opex_plan', 'tuition_simulation')
ORDER BY tablename, policyname;
*/

-- ============================================================================
-- RLS POLICIES COMPLETE
-- ============================================================================
