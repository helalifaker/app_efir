-- Check which tables are missing RLS
-- This will show which table(s) need RLS enabled

SELECT 
  tablename,
  CASE WHEN rowsecurity THEN '✅ RLS ENABLED' ELSE '❌ RLS DISABLED' END as rls_status
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

