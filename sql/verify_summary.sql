-- Quick Verification Summary
-- Run this to get all checks in a single table
-- This is the main verification you need

SELECT 
  '1. Tables' as check_name,
  COUNT(*)::text as actual_value,
  '11' as expected_value,
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
  '2. Status Values Valid' as check_name,
  COUNT(*)::text as actual_value,
  '0' as expected_value,
  CASE WHEN COUNT(*) = 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM public.model_versions
WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')

UNION ALL

SELECT 
  '3. Metric Catalog' as check_name,
  COUNT(*)::text as actual_value,
  '31' as expected_value,
  CASE WHEN COUNT(*) >= 31 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM public.metric_catalog

UNION ALL

SELECT 
  '4. Admin Config' as check_name,
  COUNT(*)::text as actual_value,
  '10' as expected_value,
  CASE WHEN COUNT(*) >= 10 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM public.admin_config

UNION ALL

SELECT 
  '5. Functions' as check_name,
  COUNT(*)::text as actual_value,
  '4' as expected_value,
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
  '6. RLS Enabled' as check_name,
  COUNT(*)::text as actual_value,
  '9' as expected_value,
  CASE WHEN COUNT(*) >= 9 THEN '✅ PASS' ELSE '⚠️  WARN' END as result
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
  '7. Phase 1 Columns' as check_name,
  COUNT(*)::text as actual_value,
  '2' as expected_value,
  CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'model_versions'
  AND column_name IN ('override_flag', 'archived_at')

UNION ALL

SELECT 
  '8. Status Constraints' as check_name,
  COUNT(*)::text as actual_value,
  '2' as expected_value,
  CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
  AND constraint_name IN (
    'model_versions_status_check',
    'version_status_history_new_status_check'
  )

ORDER BY check_name;

