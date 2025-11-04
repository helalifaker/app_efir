-- EFIR Database Verification Script
-- Run this in Supabase SQL Editor to check your database state
-- This will verify all tables, constraints, functions, and data integrity
--
-- Note: Supabase SQL Editor doesn't support psql meta-commands.
-- This script uses DO blocks and SELECT statements for compatibility.

-- ============================================================================
-- VERIFICATION RESULTS
-- ============================================================================

DO $$
DECLARE
  table_count integer;
  missing_tables text[];
  status_count integer;
  invalid_statuses text[];
  metric_count integer;
  rls_count integer;
  function_count integer;
  constraint_count integer;
  result_record record;
BEGIN
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'EFIR DATABASE VERIFICATION';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';

  -- ============================================================================
  -- 1. CHECK REQUIRED TABLES
  -- ============================================================================
  RAISE NOTICE '1. CHECKING REQUIRED TABLES...';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'models', 'model_versions', 'version_tabs', 'version_validations',
      'version_status_history', 'version_audit', 'admin_config',
      'version_metrics', 'version_computed', 'metric_catalog',
      'version_statement_lines'
    );
  
  IF table_count = 11 THEN
    RAISE NOTICE '✅ All 11 required tables exist';
  ELSE
    RAISE NOTICE '❌ Expected 11 tables, found %', table_count;
    
    -- Find missing tables
    SELECT array_agg(missing.table_name) INTO missing_tables
    FROM (
      SELECT unnest(ARRAY[
        'models', 'model_versions', 'version_tabs', 'version_validations',
        'version_status_history', 'version_audit', 'admin_config',
        'version_metrics', 'version_computed', 'metric_catalog',
        'version_statement_lines'
      ]) AS table_name
      EXCEPT
      SELECT table_name::text
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN (
          'models', 'model_versions', 'version_tabs', 'version_validations',
          'version_status_history', 'version_audit', 'admin_config',
          'version_metrics', 'version_computed', 'metric_catalog',
          'version_statement_lines'
        )
    ) missing;
    
    IF missing_tables IS NOT NULL THEN
      RAISE NOTICE '   Missing tables: %', array_to_string(missing_tables, ', ');
    END IF;
  END IF;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 2. CHECK STATUS VALUES
  -- ============================================================================
  RAISE NOTICE '2. CHECKING STATUS VALUES...';
  RAISE NOTICE '----------------------------------------';
  
  -- Check model_versions statuses
  SELECT COUNT(*) INTO status_count
  FROM public.model_versions
  WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived');
  
  IF status_count = 0 THEN
    RAISE NOTICE '✅ All status values are correctly capitalized';
  ELSE
    RAISE NOTICE '❌ Found % invalid status value(s)', status_count;
    
    -- Show invalid statuses
    RAISE NOTICE '   Invalid statuses in model_versions:';
    FOR result_record IN
      SELECT DISTINCT status, COUNT(*) as count
      FROM public.model_versions
      WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')
      GROUP BY status
    LOOP
      RAISE NOTICE '   - "%" (used % time(s))', result_record.status, result_record.count;
    END LOOP;
  END IF;
  
  -- Show status distribution
  RAISE NOTICE '   Status distribution:';
  FOR result_record IN
    SELECT status, COUNT(*) as count
    FROM public.model_versions
    GROUP BY status
    ORDER BY status
  LOOP
    RAISE NOTICE '   - %: % version(s)', result_record.status, result_record.count;
  END LOOP;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 3. CHECK STATUS CONSTRAINTS
  -- ============================================================================
  RAISE NOTICE '3. CHECKING STATUS CONSTRAINTS...';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_schema = 'public'
    AND constraint_name = 'model_versions_status_check';
  
  IF constraint_count = 1 THEN
    RAISE NOTICE '✅ Status constraint exists on model_versions';
  ELSE
    RAISE NOTICE '❌ Status constraint missing on model_versions';
  END IF;
  
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_schema = 'public'
    AND constraint_name = 'version_status_history_new_status_check';
  
  IF constraint_count = 1 THEN
    RAISE NOTICE '✅ Status constraint exists on version_status_history';
  ELSE
    RAISE NOTICE '❌ Status constraint missing on version_status_history';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 4. CHECK METRIC CATALOG
  -- ============================================================================
  RAISE NOTICE '4. CHECKING METRIC CATALOG...';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO metric_count FROM public.metric_catalog;
  
  IF metric_count >= 31 THEN
    RAISE NOTICE '✅ Metric catalog has % metrics (expected >= 31)', metric_count;
  ELSE
    RAISE NOTICE '❌ Metric catalog has only % metrics (expected >= 31)', metric_count;
  END IF;
  
  -- Show category distribution
  RAISE NOTICE '   Category distribution:';
  FOR result_record IN
    SELECT category, COUNT(*) as count
    FROM public.metric_catalog
    GROUP BY category
    ORDER BY category
  LOOP
    RAISE NOTICE '   - %: % metric(s)', result_record.category, result_record.count;
  END LOOP;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 5. CHECK ROW LEVEL SECURITY
  -- ============================================================================
  RAISE NOTICE '5. CHECKING ROW LEVEL SECURITY...';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO rls_count
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
    AND rowsecurity = true;
  
  IF rls_count >= 9 THEN
    RAISE NOTICE '✅ RLS enabled on % table(s) (expected >= 9)', rls_count;
  ELSE
    RAISE NOTICE '⚠️  RLS enabled on only % table(s) (expected >= 9)', rls_count;
  END IF;
  
  -- Show RLS status for each table
  RAISE NOTICE '   RLS status by table:';
  FOR result_record IN
    SELECT tablename, rowsecurity
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
    ORDER BY tablename
  LOOP
    IF result_record.rowsecurity THEN
      RAISE NOTICE '   ✅ %: RLS enabled', result_record.tablename;
    ELSE
      RAISE NOTICE '   ❌ %: RLS disabled', result_record.tablename;
    END IF;
  END LOOP;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 6. CHECK FUNCTIONS
  -- ============================================================================
  RAISE NOTICE '6. CHECKING FUNCTIONS...';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO function_count
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name IN (
      'can_transition_status',
      'log_version_transition',
      'get_metric_metadata',
      'get_statement_metrics',
      'mark_historical_years'
    );
  
  IF function_count >= 4 THEN
    RAISE NOTICE '✅ Found % required function(s) (expected >= 4)', function_count;
  ELSE
    RAISE NOTICE '⚠️  Found only % required function(s) (expected >= 4)', function_count;
  END IF;
  
  -- List functions
  RAISE NOTICE '   Functions:';
  FOR result_record IN
    SELECT routine_name
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name IN (
        'can_transition_status',
        'log_version_transition',
        'get_metric_metadata',
        'get_statement_metrics',
        'mark_historical_years'
      )
    ORDER BY routine_name
  LOOP
    RAISE NOTICE '   ✅ %', result_record.routine_name;
  END LOOP;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 7. CHECK ADMIN CONFIG
  -- ============================================================================
  RAISE NOTICE '7. CHECKING ADMIN CONFIG...';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO metric_count FROM public.admin_config;
  
  IF metric_count >= 10 THEN
    RAISE NOTICE '✅ Admin config has % entries (expected >= 10)', metric_count;
  ELSE
    RAISE NOTICE '⚠️  Admin config has only % entries (expected >= 10)', metric_count;
  END IF;
  
  -- Check for critical config keys
  RAISE NOTICE '   Critical config keys:';
  FOR result_record IN
    SELECT config_key
    FROM public.admin_config
    WHERE config_key IN ('vat', 'fx', 'cashEngine', 'validation')
    ORDER BY config_key
  LOOP
    RAISE NOTICE '   ✅ %', result_record.config_key;
  END LOOP;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 8. CHECK INDEXES
  -- ============================================================================
  RAISE NOTICE '8. CHECKING CRITICAL INDEXES...';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO constraint_count
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND indexname IN (
      'idx_model_versions_status',
      'idx_version_metrics_version_id',
      'idx_metric_catalog_key',
      'idx_version_statement_lines_version_id'
    );
  
  IF constraint_count >= 4 THEN
    RAISE NOTICE '✅ Found % critical index(es) (expected >= 4)', constraint_count;
  ELSE
    RAISE NOTICE '⚠️  Found only % critical index(es) (expected >= 4)', constraint_count;
  END IF;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 9. CHECK VERSION AUDIT TABLE
  -- ============================================================================
  RAISE NOTICE '9. CHECKING VERSION AUDIT...';
  RAISE NOTICE '----------------------------------------';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'version_audit') THEN
    SELECT COUNT(*) INTO status_count FROM public.version_audit;
    RAISE NOTICE '✅ Version audit table exists with % record(s)', status_count;
  ELSE
    RAISE NOTICE '❌ Version audit table missing';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- 10. CHECK PHASE 2 COLUMNS
  -- ============================================================================
  RAISE NOTICE '10. CHECKING PHASE 1 COLUMNS...';
  RAISE NOTICE '----------------------------------------';
  
  -- Check for override_flag column
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'model_versions'
      AND column_name = 'override_flag'
  ) THEN
    RAISE NOTICE '✅ override_flag column exists';
  ELSE
    RAISE NOTICE '❌ override_flag column missing';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'model_versions'
      AND column_name = 'archived_at'
  ) THEN
    RAISE NOTICE '✅ archived_at column exists';
  ELSE
    RAISE NOTICE '❌ archived_at column missing';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================================================
  -- SUMMARY
  -- ============================================================================
  RAISE NOTICE '============================================================================';
  RAISE NOTICE 'VERIFICATION COMPLETE';
  RAISE NOTICE '============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'If you see any ❌ or ⚠️  warnings above, please run the missing migrations.';
  RAISE NOTICE 'See sql/MIGRATION_CHECKLIST.md for details.';
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- DETAILED REPORTS (Run these separately to see data)
-- ============================================================================

-- 1. TABLE ROW COUNTS
-- Run this query to see row counts for all tables:
/*
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
*/

-- 2. STATUS DISTRIBUTION
-- Run this query to see status distribution:
/*
SELECT 
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.model_versions
GROUP BY status
ORDER BY status;
*/

-- 3. METRIC CATALOG BY CATEGORY
-- Run this query to see metric catalog breakdown:
/*
SELECT 
  category,
  COUNT(*) as metric_count,
  COUNT(CASE WHEN is_calculated THEN 1 END) as calculated_count,
  COUNT(CASE WHEN statement_type IS NOT NULL THEN 1 END) as statement_metrics
FROM public.metric_catalog
GROUP BY category
ORDER BY category;
*/

-- 4. ADMIN CONFIG ENTRIES
-- Run this query to see admin config entries:
/*
SELECT 
  config_key,
  version,
  updated_at,
  updated_by IS NOT NULL as has_updated_by
FROM public.admin_config
ORDER BY config_key;
*/

-- 5. CHECK FOR INVALID STATUSES
-- Run this query to find any invalid status values:
/*
SELECT 
  id,
  name,
  status,
  created_at
FROM public.model_versions
WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')
ORDER BY created_at DESC;
*/

-- 6. CHECK MISSING TABLES
-- Run this query to see which tables are missing:
/*
SELECT table_name
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
*/

