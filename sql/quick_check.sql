-- Quick Database Check
-- Run this for a fast overview of your database state
-- For detailed verification, see sql/verify_database.sql

-- ============================================================================
-- QUICK STATUS CHECK
-- ============================================================================

-- 1. Tables Check
SELECT 
  'Tables' as check_type,
  COUNT(*) as found,
  11 as expected,
  CASE WHEN COUNT(*) = 11 THEN '✅' ELSE '❌' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'models', 'model_versions', 'version_tabs', 'version_validations',
    'version_status_history', 'version_audit', 'admin_config',
    'version_metrics', 'version_computed', 'metric_catalog',
    'version_statement_lines'
  )

UNION ALL

-- 2. Status Values Check
SELECT 
  'Status Values' as check_type,
  COUNT(*) as found,
  0 as expected,
  CASE WHEN COUNT(*) = 0 THEN '✅' ELSE '❌' END as status
FROM public.model_versions
WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')

UNION ALL

-- 3. Metric Catalog Check
SELECT 
  'Metric Catalog' as check_type,
  COUNT(*) as found,
  31 as expected,
  CASE WHEN COUNT(*) >= 31 THEN '✅' ELSE '❌' END as status
FROM public.metric_catalog

UNION ALL

-- 4. Admin Config Check
SELECT 
  'Admin Config' as check_type,
  COUNT(*) as found,
  10 as expected,
  CASE WHEN COUNT(*) >= 10 THEN '✅' ELSE '❌' END as status
FROM public.admin_config

UNION ALL

-- 5. Functions Check
SELECT 
  'Functions' as check_type,
  COUNT(*) as found,
  4 as expected,
  CASE WHEN COUNT(*) >= 4 THEN '✅' ELSE '❌' END as status
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'can_transition_status',
    'log_version_transition',
    'get_metric_metadata',
    'get_statement_metrics'
  )

UNION ALL

-- 6. RLS Check
SELECT 
  'RLS Enabled' as check_type,
  COUNT(*) as found,
  9 as expected,
  CASE WHEN COUNT(*) >= 9 THEN '✅' ELSE '❌' END as status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'metric_catalog',
    'version_statement_lines',
    'models',
    'model_versions',
    'version_tabs',
    'version_validations',
    'version_status_history',
    'version_audit',
    'admin_config',
    'version_metrics',
    'version_computed'
  )
  AND rowsecurity = true

ORDER BY check_type;

-- ============================================================================
-- STATUS DISTRIBUTION
-- ============================================================================

SELECT 
  status,
  COUNT(*) as count
FROM public.model_versions
GROUP BY status
ORDER BY status;

-- ============================================================================
-- MISSING TABLES (if any)
-- ============================================================================

SELECT table_name as missing_table
FROM (
  SELECT unnest(ARRAY[
    'models', 'model_versions', 'version_tabs', 'version_validations',
    'version_status_history', 'version_audit', 'admin_config',
    'version_metrics', 'version_computed', 'metric_catalog',
    'version_statement_lines'
  ]) AS table_name
) required
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = required.table_name
)
ORDER BY table_name;

