-- Phase 2: RLS Policies for Data Model Tables
-- Run this AFTER phase2_data_model.sql
--
-- This adds RLS policies for:
-- 1. metric_catalog: Public read, admin write
-- 2. version_statement_lines: Inherits from model_versions (owner-based)

-- ============================================================================
-- 1. METRIC_CATALOG TABLE POLICIES
-- ============================================================================

ALTER TABLE public.metric_catalog ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read metric catalog" ON public.metric_catalog;
DROP POLICY IF EXISTS "Admins can manage metric catalog" ON public.metric_catalog;
DROP POLICY IF EXISTS "Service role can manage metric catalog" ON public.metric_catalog;

-- Public read access (anyone authenticated can read)
CREATE POLICY "Anyone can read metric catalog"
  ON public.metric_catalog
  FOR SELECT
  TO authenticated
  USING (true);

-- Write access: Only service role can write (via API routes with admin checks)
-- Regular authenticated users can only read
-- API routes use service role (which bypasses RLS) and check admin status in application code
-- Note: We don't check admin status in RLS because user_metadata is not easily accessible
-- Service role automatically bypasses RLS, so no policy needed for writes
-- Explicit grant ensures service role has access
GRANT ALL ON public.metric_catalog TO service_role;

-- ============================================================================
-- 2. VERSION_STATEMENT_LINES TABLE POLICIES
-- ============================================================================

ALTER TABLE public.version_statement_lines ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view statement lines for their versions" ON public.version_statement_lines;
DROP POLICY IF EXISTS "Users can manage statement lines for their versions" ON public.version_statement_lines;

-- Inherit access from model_versions (users can only see lines for versions they own)
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
        OR m.owner_id IS NULL -- Allow access to test models
      )
    )
  );

-- Users can manage statement lines for versions they own
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
        OR m.owner_id IS NULL -- Allow access to test models
      )
    )
  );

-- Service role bypass
GRANT ALL ON public.version_statement_lines TO service_role;

-- ============================================================================
-- DONE! Phase 2 RLS policies created successfully.
-- ============================================================================

