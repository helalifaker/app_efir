-- Database Security Assessment
-- Run this to get a comprehensive security overview

-- ============================================================================
-- 1. RLS STATUS - ALL TABLES
-- ============================================================================

SELECT 
  'RLS STATUS' as assessment_category,
  tablename as item,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED - SECURITY RISK!'
  END as status,
  CASE 
    WHEN rowsecurity THEN 'Protected by RLS policies'
    ELSE 'No RLS protection - all authenticated users can access'
  END as details
FROM pg_tables
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
    'version_statement_lines',
    'app_settings'
  )
ORDER BY 
  CASE WHEN rowsecurity THEN 1 ELSE 2 END,
  tablename;

-- ============================================================================
-- 2. RLS POLICIES COUNT
-- ============================================================================

SELECT 
  'POLICY COUNT' as assessment_category,
  schemaname || '.' || tablename as table_name,
  COUNT(*)::text as policy_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️  NO POLICIES'
    WHEN COUNT(*) < 2 THEN '⚠️  MINIMAL POLICIES'
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
GROUP BY schemaname, tablename
ORDER BY policy_count ASC, tablename;

-- ============================================================================
-- 3. FUNCTIONS WITH SECURITY DEFINER
-- ============================================================================

SELECT 
  'SECURITY FUNCTIONS' as assessment_category,
  routine_name as function_name,
  CASE 
    WHEN security_type = 'DEFINER' THEN '✅ SECURITY DEFINER'
    ELSE '⚠️  INVOKER'
  END as security_type,
  CASE 
    WHEN security_type = 'DEFINER' THEN 'Runs with elevated privileges'
    ELSE 'Runs with caller privileges'
  END as details
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'user_owns_model',
    'get_model_id_from_version',
    'can_transition_status',
    'log_version_transition'
  )
ORDER BY routine_name;

-- ============================================================================
-- 4. NULL OWNER CHECK (SECURITY RISK)
-- ============================================================================

SELECT 
  'NULL OWNERS' as assessment_category,
  'models' as table_name,
  COUNT(*)::text as null_owner_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO NULL OWNERS'
    WHEN COUNT(*) <= 5 THEN '⚠️  SOME NULL OWNERS (DEV/TEST)'
    ELSE '❌ MANY NULL OWNERS - SECURITY RISK!'
  END as status,
  CASE 
    WHEN COUNT(*) = 0 THEN 'All models have owners - production ready'
    ELSE 'Models with NULL owner_id are readable by ALL authenticated users'
  END as details
FROM public.models
WHERE owner_id IS NULL

UNION ALL

SELECT 
  'NULL OWNERS' as assessment_category,
  'model_versions' as table_name,
  COUNT(*)::text as null_owner_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO NULL CREATORS'
    ELSE '⚠️  SOME NULL CREATORS'
  END as status,
  'Versions with NULL created_by lack audit trail' as details
FROM public.model_versions
WHERE created_by IS NULL;

-- ============================================================================
-- 5. CONSTRAINT CHECK (DATA INTEGRITY)
-- ============================================================================

SELECT 
  'CONSTRAINTS' as assessment_category,
  checks.constraint_name,
  checks.table_name,
  CASE 
    WHEN tc.constraint_name IS NOT NULL THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as status
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
ORDER BY checks.table_name, checks.constraint_name;

-- ============================================================================
-- 6. INDEX ANALYSIS (PERFORMANCE + SECURITY)
-- ============================================================================

SELECT 
  'INDEXES' as assessment_category,
  tablename,
  COUNT(*)::text as index_count,
  CASE 
    WHEN COUNT(*) >= 3 THEN '✅ WELL INDEXED'
    WHEN COUNT(*) >= 1 THEN '⚠️  MINIMAL INDEXES'
    ELSE '❌ NO INDEXES'
  END as status
FROM pg_indexes
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
ORDER BY index_count ASC, tablename;

-- ============================================================================
-- 7. CASCADE DELETE PROTECTION
-- ============================================================================

SELECT 
  'CASCADE DELETE' as assessment_category,
  tc.table_name as child_table,
  kcu.column_name as foreign_key,
  ccu.table_name as parent_table,
  CASE 
    WHEN rc.delete_rule = 'CASCADE' THEN '✅ CASCADE (safe)'
    ELSE '⚠️  ' || rc.delete_rule
  END as delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'model_versions',
    'version_tabs',
    'version_validations',
    'version_status_history',
    'version_audit',
    'version_metrics',
    'version_computed',
    'version_statement_lines'
  )
ORDER BY tc.table_name;

-- ============================================================================
-- 8. SUMMARY ASSESSMENT
-- ============================================================================

SELECT 
  'OVERALL SECURITY' as assessment_category,
  'RLS Coverage' as metric,
  COUNT(*)::text as tables_with_rls,
  '11' as expected,
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

