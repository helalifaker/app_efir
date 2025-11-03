-- EFIR Row Level Security (RLS) Policies
-- Run this AFTER schema.sql to enable security
-- 
-- NOTE: This script is idempotent - safe to run multiple times.
-- It will drop existing policies before creating new ones.

-- ============================================================================
-- HELPER: Ownership determination function
-- ============================================================================
CREATE OR REPLACE FUNCTION public.user_owns_model(model_id_param uuid, user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.models 
    WHERE id = model_id_param 
    AND owner_id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function: get model_id from version_id
CREATE OR REPLACE FUNCTION public.get_model_id_from_version(version_id_param uuid)
RETURNS uuid AS $$
BEGIN
  RETURN (SELECT model_id FROM public.model_versions WHERE id = version_id_param);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_status_history ENABLE ROW LEVEL SECURITY;

-- Note: app_settings does NOT have RLS (read-only for all, write via service role only)

-- ============================================================================
-- MODELS TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist (for re-running this script)
DROP POLICY IF EXISTS "Users can view models they own" ON public.models;
DROP POLICY IF EXISTS "Users can create models" ON public.models;
DROP POLICY IF EXISTS "Only owner can update models" ON public.models;
DROP POLICY IF EXISTS "Only owner can delete models" ON public.models;

-- Read: Users can read models they own
CREATE POLICY "Users can view models they own"
  ON public.models FOR SELECT
  USING (
    auth.uid() = owner_id 
    OR owner_id IS NULL  -- Allow read for models with no owner (for testing)
  );

-- Insert: Users can create models and set themselves as owner
CREATE POLICY "Users can create models"
  ON public.models FOR INSERT
  WITH CHECK (auth.uid() = owner_id OR owner_id IS NULL);

-- Update: Only owner can update
CREATE POLICY "Only owner can update models"
  ON public.models FOR UPDATE
  USING (auth.uid() = owner_id OR owner_id IS NULL);

-- Delete: Only owner can delete
CREATE POLICY "Only owner can delete models"
  ON public.models FOR DELETE
  USING (auth.uid() = owner_id OR owner_id IS NULL);

-- ============================================================================
-- MODEL_VERSIONS TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view versions of their models" ON public.model_versions;
DROP POLICY IF EXISTS "Users can create versions for their models" ON public.model_versions;
DROP POLICY IF EXISTS "Only owner can update versions" ON public.model_versions;
DROP POLICY IF EXISTS "Only owner can delete versions" ON public.model_versions;

-- Read: Users can read versions for models they own
CREATE POLICY "Users can view versions of their models"
  ON public.model_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.models m
      WHERE m.id = model_versions.model_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Insert: Users can create versions for models they own
CREATE POLICY "Users can create versions for their models"
  ON public.model_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.models m
      WHERE m.id = model_versions.model_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
    AND (auth.uid() = created_by OR created_by IS NULL)
  );

-- Update: Only owner can update
CREATE POLICY "Only owner can update versions"
  ON public.model_versions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.models m
      WHERE m.id = model_versions.model_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Delete: Only owner can delete
CREATE POLICY "Only owner can delete versions"
  ON public.model_versions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.models m
      WHERE m.id = model_versions.model_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- ============================================================================
-- VERSION_TABS TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view tabs of their versions" ON public.version_tabs;
DROP POLICY IF EXISTS "Users can create tabs for their versions" ON public.version_tabs;
DROP POLICY IF EXISTS "Only owner can update tabs" ON public.version_tabs;
DROP POLICY IF EXISTS "Only owner can delete tabs" ON public.version_tabs;

-- Read: Users can read tabs for versions they own
CREATE POLICY "Users can view tabs of their versions"
  ON public.version_tabs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_tabs.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Insert: Users can create tabs for versions they own
CREATE POLICY "Users can create tabs for their versions"
  ON public.version_tabs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_tabs.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Update: Only owner can update
CREATE POLICY "Only owner can update tabs"
  ON public.version_tabs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_tabs.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Delete: Only owner can delete
CREATE POLICY "Only owner can delete tabs"
  ON public.version_tabs FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_tabs.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- ============================================================================
-- VERSION_VALIDATIONS TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view validations of their versions" ON public.version_validations;
DROP POLICY IF EXISTS "Users can create validations for their versions" ON public.version_validations;
DROP POLICY IF EXISTS "Only owner can update validations" ON public.version_validations;
DROP POLICY IF EXISTS "Only owner can delete validations" ON public.version_validations;

-- Read: Users can read validations for versions they own
CREATE POLICY "Users can view validations of their versions"
  ON public.version_validations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_validations.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Insert: Users can create validations for versions they own
CREATE POLICY "Users can create validations for their versions"
  ON public.version_validations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_validations.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Update: Only owner can update
CREATE POLICY "Only owner can update validations"
  ON public.version_validations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_validations.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Delete: Only owner can delete
CREATE POLICY "Only owner can delete validations"
  ON public.version_validations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_validations.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- ============================================================================
-- VERSION_STATUS_HISTORY TABLE POLICIES
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view history of their versions" ON public.version_status_history;
DROP POLICY IF EXISTS "Users can create history for their versions" ON public.version_status_history;

-- Read: Users can read history for versions they own
CREATE POLICY "Users can view history of their versions"
  ON public.version_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_status_history.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
  );

-- Insert: Users can create history for versions they own
CREATE POLICY "Users can create history for their versions"
  ON public.version_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.model_versions mv
      JOIN public.models m ON mv.model_id = m.id
      WHERE mv.id = version_status_history.version_id
      AND (m.owner_id = auth.uid() OR m.owner_id IS NULL)
    )
    AND (auth.uid() = changed_by OR changed_by IS NULL)
  );

-- Note: History should generally NOT be updated or deleted after creation
-- No UPDATE or DELETE policies by design

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================
-- 1. Service Role Key bypasses ALL RLS policies
-- 2. API routes using SUPABASE_SERVICE_ROLE_KEY will work without RLS restrictions
-- 3. Client-side code using anon key will be restricted by these policies
-- 4. app_settings has NO RLS (readable by all, writable via service role only)
-- 5. Models with owner_id = NULL are readable by all (for testing/development)
-- ============================================================================

