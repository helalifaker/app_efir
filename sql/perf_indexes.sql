-- Performance Indexes for EFIR
-- Run this AFTER schema.sql and rls_policies.sql
-- These indexes optimize common query patterns

-- ============================================================================
-- VERSION_TABS - Composite index for version_id + tab lookups
-- ============================================================================
-- Already covered by UNIQUE(version_id, tab), but explicit index helps
-- Optimizes: WHERE version_id = ? AND tab IN ('pnl', 'bs', 'cf')
CREATE INDEX IF NOT EXISTS idx_version_tabs_version_tab 
  ON public.version_tabs(version_id, tab);

-- ============================================================================
-- VERSION_VALIDATIONS - Composite index for status check queries
-- ============================================================================
-- Optimizes: WHERE version_id = ? AND severity = 'error'
-- Used when checking if version can transition to 'ready'
CREATE INDEX IF NOT EXISTS idx_version_validations_version_severity 
  ON public.version_validations(version_id, severity);

-- Also add index for created_at ordering (used in getVersionWithTabs)
CREATE INDEX IF NOT EXISTS idx_version_validations_version_created 
  ON public.version_validations(version_id, created_at DESC);

-- ============================================================================
-- VERSION_STATUS_HISTORY - Composite index for paginated queries
-- ============================================================================
-- Optimizes: WHERE version_id = ? ORDER BY changed_at DESC
-- Used in history API with pagination
CREATE INDEX IF NOT EXISTS idx_vsh_version_changed_at 
  ON public.version_status_history(version_id, changed_at DESC);

-- ============================================================================
-- MODEL_VERSIONS - Composite indexes for join queries
-- ============================================================================
-- Optimizes: JOIN queries with model_id and ordering by created_at
-- Used in compare and versions list APIs
CREATE INDEX IF NOT EXISTS idx_model_versions_model_created 
  ON public.model_versions(model_id, created_at DESC);

-- Optimizes: Filtering by status and ordering
CREATE INDEX IF NOT EXISTS idx_model_versions_status_created 
  ON public.model_versions(status, created_at DESC);

-- ============================================================================
-- VERIFY INDEXES
-- ============================================================================
-- Run this to verify indexes were created:
-- SELECT 
--   schemaname,
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename IN ('version_tabs', 'version_validations', 'version_status_history', 'model_versions')
-- ORDER BY tablename, indexname;

