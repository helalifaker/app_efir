-- Complete Database Verification
-- Run this to check all aspects of your database setup

-- ============================================================================
-- 1. COMPREHENSIVE CHECK SUMMARY
-- ============================================================================

SELECT 
  'Tables' as check_type,
  COUNT(*) as found,
  11 as expected,
  CASE WHEN COUNT(*) = 11 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'models', 'model_versions', 'version_tabs', 'version_validations',
    'version_status_history', 'version_audit', 'admin_config',
    'version_metrics', 'version_computed', 'metric_catalog',
    'version_statement_lines'
  )

UNION ALL

SELECT 
  'Status Values Valid' as check_type,
  COUNT(*) as found,
  0 as expected,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM public.model_versions
WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')

UNION ALL

SELECT 
  'Metric Catalog' as check_type,
  COUNT(*) as found,
  31 as expected,
  CASE WHEN COUNT(*) >= 31 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM public.metric_catalog

UNION ALL

SELECT 
  'Admin Config' as check_type,
  COUNT(*) as found,
  10 as expected,
  CASE WHEN COUNT(*) >= 10 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM public.admin_config

UNION ALL

SELECT 
  'Functions' as check_type,
  COUNT(*) as found,
  4 as expected,
  CASE WHEN COUNT(*) >= 4 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'can_transition_status',
    'log_version_transition',
    'get_metric_metadata',
    'get_statement_metrics'
  )

UNION ALL

SELECT 
  'RLS Enabled' as check_type,
  COUNT(*) as found,
  9 as expected,
  CASE WHEN COUNT(*) >= 9 THEN '✅ PASS' ELSE '❌ FAIL' END as result
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

UNION ALL

SELECT 
  'Phase 1 Columns' as check_type,
  COUNT(*) as found,
  2 as expected,
  CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'model_versions'
  AND column_name IN ('override_flag', 'archived_at')

ORDER BY check_type;

-- ============================================================================
-- 2. STATUS DISTRIBUTION (You already shared this - confirming it's correct)
-- ============================================================================

SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.model_versions
GROUP BY status
ORDER BY status;

-- ============================================================================
-- 3. TABLE ROW COUNTS
-- ============================================================================

SELECT 
  'models' as table_name,
  COUNT(*) as row_count
FROM public.models
UNION ALL
SELECT 'model_versions', COUNT(*) FROM public.model_versions
UNION ALL
SELECT 'version_tabs', COUNT(*) FROM public.version_tabs
UNION ALL
SELECT 'version_validations', COUNT(*) FROM public.version_validations
UNION ALL
SELECT 'version_status_history', COUNT(*) FROM public.version_status_history
UNION ALL
SELECT 'version_audit', COUNT(*) FROM public.version_audit
UNION ALL
SELECT 'admin_config', COUNT(*) FROM public.admin_config
UNION ALL
SELECT 'version_metrics', COUNT(*) FROM public.version_metrics
UNION ALL
SELECT 'version_computed', COUNT(*) FROM public.version_computed
UNION ALL
SELECT 'metric_catalog', COUNT(*) FROM public.metric_catalog
UNION ALL
SELECT 'version_statement_lines', COUNT(*) FROM public.version_statement_lines
ORDER BY table_name;

-- ============================================================================
-- 4. METRIC CATALOG BREAKDOWN
-- ============================================================================

SELECT 
  category,
  COUNT(*) as total_metrics,
  COUNT(CASE WHEN is_calculated THEN 1 END) as calculated,
  COUNT(CASE WHEN statement_type IS NOT NULL THEN 1 END) as in_statements
FROM public.metric_catalog
GROUP BY category
ORDER BY category;

-- ============================================================================
-- 5. ADMIN CONFIG STATUS
-- ============================================================================

SELECT 
  config_key,
  version,
  updated_at,
  CASE WHEN updated_by IS NOT NULL THEN '✅' ELSE '❌' END as has_updated_by
FROM public.admin_config
ORDER BY config_key;

-- ============================================================================
-- 6. CHECK FOR MISSING TABLES
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

-- ============================================================================
-- 7. CHECK FOR CONSTRAINTS
-- ============================================================================

SELECT 
  checks.constraint_name,
  checks.table_name,
  CASE WHEN tc.constraint_name IS NOT NULL THEN '✅' ELSE '❌' END as exists
FROM (
  SELECT 
    'model_versions_status_check' as constraint_name,
    'model_versions' as table_name
  UNION ALL
  SELECT 
    'version_status_history_new_status_check',
    'version_status_history'
) checks
LEFT JOIN information_schema.table_constraints tc
  ON tc.constraint_schema = 'public'
  AND tc.constraint_name = checks.constraint_name
ORDER BY checks.table_name;

