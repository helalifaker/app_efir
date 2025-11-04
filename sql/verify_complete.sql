-- Complete Database Verification
-- Run this to check ALL components of your database setup
-- This provides a comprehensive overview in a single run

-- ============================================================================
-- MAIN VERIFICATION SUMMARY
-- ============================================================================

SELECT 
  '1. Tables' as component,
  COUNT(*)::text as found,
  '11' as expected,
  CASE WHEN COUNT(*) = 11 THEN '✅ PASS' ELSE '❌ FAIL - Missing ' || (11 - COUNT(*))::text || ' table(s)' END as status
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
  '2. Status Values' as component,
  COUNT(*)::text as found,
  '0' as expected,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL - ' || COUNT(*)::text || ' invalid status value(s)' END as status
FROM public.model_versions
WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')

UNION ALL

SELECT 
  '3. Metric Catalog' as component,
  COUNT(*)::text as found,
  '31' as expected,
  CASE WHEN COUNT(*) >= 31 THEN '✅ PASS' ELSE '❌ FAIL - Only ' || COUNT(*)::text || ' metrics (expected >= 31)' END as status
FROM public.metric_catalog

UNION ALL

SELECT 
  '4. Admin Config' as component,
  COUNT(*)::text as found,
  '10' as expected,
  CASE WHEN COUNT(*) >= 10 THEN '✅ PASS' ELSE '❌ FAIL - Only ' || COUNT(*)::text || ' entries (expected >= 10)' END as status
FROM public.admin_config

UNION ALL

SELECT 
  '5. Functions' as component,
  COUNT(*)::text as found,
  '4' as expected,
  CASE WHEN COUNT(*) >= 4 THEN '✅ PASS' ELSE '❌ FAIL - Only ' || COUNT(*)::text || ' function(s) (expected >= 4)' END as status
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
  '6. RLS Enabled' as component,
  COUNT(*)::text as found,
  '9' as expected,
  CASE WHEN COUNT(*) >= 9 THEN '✅ PASS' ELSE '⚠️  WARNING - Only ' || COUNT(*)::text || ' table(s) with RLS (expected >= 9)' END as status
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
  '7. Phase 1 Columns' as component,
  COUNT(*)::text as found,
  '2' as expected,
  CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL - Missing column(s)' END as status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'model_versions'
  AND column_name IN ('override_flag', 'archived_at')

UNION ALL

SELECT 
  '8. Status Constraints' as component,
  COUNT(*)::text as found,
  '2' as expected,
  CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL - Missing constraint(s)' END as status
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_name IN (
    'model_versions_status_check',
    'version_status_history_new_status_check'
  )

ORDER BY component;

-- ============================================================================
-- DETAILED BREAKDOWN
-- ============================================================================

-- Table Existence Check
SELECT 
  'TABLE CHECK' as report_type,
  table_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t.table_name
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  SELECT unnest(ARRAY[
    'models', 'model_versions', 'version_tabs', 'version_validations',
    'version_status_history', 'version_audit', 'admin_config',
    'version_metrics', 'version_computed', 'metric_catalog',
    'version_statement_lines'
  ]) AS table_name
) t
ORDER BY table_name;

-- Function Existence Check
SELECT 
  'FUNCTION CHECK' as report_type,
  function_name,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = f.function_name
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (
  SELECT unnest(ARRAY[
    'can_transition_status',
    'log_version_transition',
    'get_metric_metadata',
    'get_statement_metrics',
    'mark_historical_years'
  ]) AS function_name
) f
ORDER BY function_name;

-- RLS Status by Table
SELECT 
  'RLS CHECK' as report_type,
  tablename as table_name,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as status
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
ORDER BY tablename;

-- Metric Catalog by Category
SELECT 
  'METRIC CATALOG' as report_type,
  category,
  COUNT(*)::text as metric_count,
  COUNT(CASE WHEN is_calculated THEN 1 END)::text as calculated,
  COUNT(CASE WHEN statement_type IS NOT NULL THEN 1 END)::text as in_statements
FROM public.metric_catalog
GROUP BY category
ORDER BY category;

-- Admin Config Entries
SELECT 
  'ADMIN CONFIG' as report_type,
  config_key,
  version::text as version,
  CASE WHEN updated_by IS NOT NULL THEN '✅' ELSE '⚠️' END as has_updater
FROM public.admin_config
ORDER BY config_key;

-- Table Row Counts
SELECT 
  'ROW COUNTS' as report_type,
  'models' as table_name,
  COUNT(*)::text as row_count
FROM public.models
UNION ALL
SELECT 'ROW COUNTS', 'model_versions', COUNT(*)::text FROM public.model_versions
UNION ALL
SELECT 'ROW COUNTS', 'version_tabs', COUNT(*)::text FROM public.version_tabs
UNION ALL
SELECT 'ROW COUNTS', 'version_validations', COUNT(*)::text FROM public.version_validations
UNION ALL
SELECT 'ROW COUNTS', 'version_status_history', COUNT(*)::text FROM public.version_status_history
UNION ALL
SELECT 'ROW COUNTS', 'version_audit', COUNT(*)::text FROM public.version_audit
UNION ALL
SELECT 'ROW COUNTS', 'admin_config', COUNT(*)::text FROM public.admin_config
UNION ALL
SELECT 'ROW COUNTS', 'version_metrics', COUNT(*)::text FROM public.version_metrics
UNION ALL
SELECT 'ROW COUNTS', 'version_computed', COUNT(*)::text FROM public.version_computed
UNION ALL
SELECT 'ROW COUNTS', 'metric_catalog', COUNT(*)::text FROM public.metric_catalog
UNION ALL
SELECT 'ROW COUNTS', 'version_statement_lines', COUNT(*)::text FROM public.version_statement_lines
ORDER BY table_name;

-- Status Distribution
SELECT 
  'STATUS DIST' as report_type,
  status,
  COUNT(*)::text as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::text as percentage
FROM public.model_versions
GROUP BY status
ORDER BY status;

-- Missing Tables (if any)
SELECT 
  'MISSING TABLES' as report_type,
  table_name,
  '❌ MISSING' as status
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

