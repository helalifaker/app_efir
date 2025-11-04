-- ============================================================================
-- FINAL COMPREHENSIVE DATABASE CHECK
-- Run this to verify your database is production-ready
-- ============================================================================

-- ============================================================================
-- SECTION 1: MAIN VERIFICATION SUMMARY
-- ============================================================================

SELECT 
  '=== MAIN VERIFICATION SUMMARY ===' as section,
  '' as component,
  '' as found,
  '' as expected,
  '' as status;

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
  '11' as expected,
  CASE WHEN COUNT(*) >= 11 THEN '✅ PASS' ELSE '⚠️  WARNING - Only ' || COUNT(*)::text || ' table(s) with RLS (expected >= 11)' END as status
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
-- SECTION 2: SECURITY ASSESSMENT
-- ============================================================================

SELECT 
  '=== SECURITY ASSESSMENT ===' as section,
  '' as item,
  '' as value,
  '' as expected,
  '' as status;

-- RLS Status by Table
SELECT 
  'RLS Status' as category,
  tablename as item,
  CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END as value,
  'ENABLED' as expected,
  CASE WHEN rowsecurity THEN '✅ PASS' ELSE '❌ FAIL - SECURITY RISK!' END as status
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
ORDER BY 
  CASE WHEN rowsecurity THEN 1 ELSE 2 END,
  tablename;

-- RLS Policy Count
SELECT 
  'Policy Count' as category,
  tablename as item,
  COUNT(*)::text as value,
  '>= 1' as expected,
  CASE 
    WHEN COUNT(*) = 0 THEN '❌ NO POLICIES'
    WHEN COUNT(*) < 2 THEN '⚠️  MINIMAL'
    ELSE '✅ PROTECTED'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'models',
    'model_versions',
    'version_tabs',
    'version_validations',
    'version_status_history',
    'version_audit',
    'admin_config',
    'version_metrics',
    'version_computed',
    'metric_catalog',
    'version_statement_lines'
  )
GROUP BY tablename
ORDER BY COUNT(*) ASC, tablename;

-- NULL Owner Check
SELECT 
  'NULL Owners' as category,
  'models' as item,
  COUNT(*)::text as value,
  '0' as expected,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO NULL OWNERS'
    WHEN COUNT(*) <= 5 THEN '⚠️  SOME NULL (DEV/TEST)'
    ELSE '❌ MANY NULL - SECURITY RISK!'
  END as status
FROM public.models
WHERE owner_id IS NULL

UNION ALL

SELECT 
  'NULL Creators' as category,
  'model_versions' as item,
  COUNT(*)::text as value,
  '0' as expected,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO NULL CREATORS'
    ELSE '⚠️  SOME NULL CREATORS'
  END as status
FROM public.model_versions
WHERE created_by IS NULL;

-- ============================================================================
-- SECTION 3: DETAILED BREAKDOWN
-- ============================================================================

SELECT 
  '=== DETAILED BREAKDOWN ===' as section,
  '' as report_type,
  '' as item,
  '' as value,
  '' as status;

-- Table Existence
SELECT 
  'TABLE CHECK' as report_type,
  table_name as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = t.table_name
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as value,
  '' as status
FROM (
  SELECT unnest(ARRAY[
    'models', 'model_versions', 'version_tabs', 'version_validations',
    'version_status_history', 'version_audit', 'admin_config',
    'version_metrics', 'version_computed', 'metric_catalog',
    'version_statement_lines'
  ]) AS table_name
) t
ORDER BY table_name;

-- Function Existence
SELECT 
  'FUNCTION CHECK' as report_type,
  function_name as item,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.routines
    WHERE routine_schema = 'public' AND routine_name = f.function_name
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as value,
  '' as status
FROM (
  SELECT unnest(ARRAY[
    'can_transition_status',
    'log_version_transition',
    'get_metric_metadata',
    'get_statement_metrics'
  ]) AS function_name
) f
ORDER BY function_name;

-- Metric Catalog by Category
SELECT 
  'METRIC CATALOG' as report_type,
  category as item,
  COUNT(*)::text || ' metrics' as value,
  '' as status
FROM public.metric_catalog
GROUP BY category
ORDER BY category;

-- Admin Config Entries
SELECT 
  'ADMIN CONFIG' as report_type,
  config_key as item,
  version::text || ' (updated_by: ' || COALESCE(updated_by::text, 'NULL') || ')' as value,
  CASE WHEN updated_by IS NOT NULL THEN '✅' ELSE '⚠️' END as status
FROM public.admin_config
ORDER BY config_key;

-- Table Row Counts
SELECT 
  'ROW COUNTS' as report_type,
  'models' as item,
  COUNT(*)::text as value,
  '' as status
FROM public.models
UNION ALL
SELECT 'ROW COUNTS', 'model_versions', COUNT(*)::text, '' FROM public.model_versions
UNION ALL
SELECT 'ROW COUNTS', 'version_tabs', COUNT(*)::text, '' FROM public.version_tabs
UNION ALL
SELECT 'ROW COUNTS', 'version_validations', COUNT(*)::text, '' FROM public.version_validations
UNION ALL
SELECT 'ROW COUNTS', 'version_status_history', COUNT(*)::text, '' FROM public.version_status_history
UNION ALL
SELECT 'ROW COUNTS', 'version_audit', COUNT(*)::text, '' FROM public.version_audit
UNION ALL
SELECT 'ROW COUNTS', 'admin_config', COUNT(*)::text, '' FROM public.admin_config
UNION ALL
SELECT 'ROW COUNTS', 'version_metrics', COUNT(*)::text, '' FROM public.version_metrics
UNION ALL
SELECT 'ROW COUNTS', 'version_computed', COUNT(*)::text, '' FROM public.version_computed
UNION ALL
SELECT 'ROW COUNTS', 'metric_catalog', COUNT(*)::text, '' FROM public.metric_catalog
UNION ALL
SELECT 'ROW COUNTS', 'version_statement_lines', COUNT(*)::text, '' FROM public.version_statement_lines
ORDER BY item;

-- Status Distribution
SELECT 
  'STATUS DIST' as report_type,
  status as item,
  COUNT(*)::text || ' (' || ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2)::text || '%)' as value,
  '' as status
FROM public.model_versions
GROUP BY status
ORDER BY status;

-- Missing Tables (if any)
SELECT 
  'MISSING TABLES' as report_type,
  table_name as item,
  '❌ MISSING' as value,
  '' as status
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
-- SECTION 4: OVERALL ASSESSMENT
-- ============================================================================

SELECT 
  '=== OVERALL ASSESSMENT ===' as section,
  '' as metric,
  '' as value,
  '' as expected,
  '' as grade;

-- Overall RLS Coverage
SELECT 
  'RLS Coverage' as metric,
  COUNT(*)::text || '/11 tables' as value,
  '11/11' as expected,
  CASE 
    WHEN COUNT(*) >= 11 THEN '✅ EXCELLENT'
    WHEN COUNT(*) >= 9 THEN '⚠️  GOOD'
    ELSE '❌ NEEDS ATTENTION'
  END as grade
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = true
  AND tablename IN (
    'models',
    'model_versions',
    'version_tabs',
    'version_validations',
    'version_status_history',
    'version_audit',
    'admin_config',
    'version_metrics',
    'version_computed',
    'metric_catalog',
    'version_statement_lines'
  );

-- Data Integrity
SELECT 
  'Data Integrity' as metric,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.model_versions WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) = 0
      AND (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name IN ('model_versions_status_check', 'version_status_history_new_status_check')) = 2
    THEN '✅ VALID'
    ELSE '❌ ISSUES FOUND'
  END as value,
  'All valid' as expected,
  CASE 
    WHEN (SELECT COUNT(*) FROM public.model_versions WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) = 0
      AND (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = 'public' AND constraint_name IN ('model_versions_status_check', 'version_status_history_new_status_check')) = 2
    THEN '✅ PASS'
    ELSE '❌ FAIL'
  END as grade;

-- Production Readiness
SELECT 
  'Production Ready' as metric,
  CASE 
    WHEN 
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('models', 'model_versions', 'version_tabs', 'version_validations', 'version_status_history', 'version_audit', 'admin_config', 'version_metrics', 'version_computed', 'metric_catalog', 'version_statement_lines')) = 11
      AND (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true AND tablename IN ('models', 'model_versions', 'version_tabs', 'version_validations', 'version_status_history', 'version_audit', 'admin_config', 'version_metrics', 'version_computed', 'metric_catalog', 'version_statement_lines')) >= 11
      AND (SELECT COUNT(*) FROM public.model_versions WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) = 0
      AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('can_transition_status', 'log_version_transition', 'get_metric_metadata', 'get_statement_metrics')) >= 4
    THEN '✅ READY'
    ELSE '⚠️  NEEDS REVIEW'
  END as value,
  'All checks pass' as expected,
  CASE 
    WHEN 
      (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('models', 'model_versions', 'version_tabs', 'version_validations', 'version_status_history', 'version_audit', 'admin_config', 'version_metrics', 'version_computed', 'metric_catalog', 'version_statement_lines')) = 11
      AND (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true AND tablename IN ('models', 'model_versions', 'version_tabs', 'version_validations', 'version_status_history', 'version_audit', 'admin_config', 'version_metrics', 'version_computed', 'metric_catalog', 'version_statement_lines')) >= 11
      AND (SELECT COUNT(*) FROM public.model_versions WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) = 0
      AND (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('can_transition_status', 'log_version_transition', 'get_metric_metadata', 'get_statement_metrics')) >= 4
    THEN '✅ PASS'
    ELSE '⚠️  REVIEW NEEDED'
  END as grade;

-- ============================================================================
-- END OF FINAL CHECK
-- ============================================================================

