-- Verify NULL Owner Models
-- Run this to check for models and versions with NULL owners

-- ============================================================================
-- 1. NULL OWNER MODELS CHECK
-- ============================================================================

SELECT 
  'NULL OWNER CHECK' as check_type,
  'models' as table_name,
  COUNT(*)::text as null_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO NULL OWNERS - PRODUCTION READY'
    WHEN COUNT(*) <= 5 THEN '⚠️  SOME NULL OWNERS (DEV/TEST - OK for development)'
    ELSE '❌ MANY NULL OWNERS - SECURITY RISK!'
  END as status,
  CASE 
    WHEN COUNT(*) = 0 THEN 'All models have owners - secure'
    WHEN COUNT(*) <= 5 THEN 'NULL owners are readable by ALL authenticated users'
    ELSE 'Many models without owners - assign owners before production'
  END as details
FROM public.models
WHERE owner_id IS NULL;

-- ============================================================================
-- 2. LIST NULL OWNER MODELS (if any exist)
-- ============================================================================

SELECT 
  'NULL OWNER MODELS' as report_type,
  m.id,
  m.name,
  m.description,
  m.created_at
FROM public.models m
WHERE m.owner_id IS NULL
ORDER BY m.created_at DESC;

-- ============================================================================
-- 3. NULL CREATED_BY VERSIONS CHECK
-- ============================================================================

SELECT 
  'NULL CREATOR CHECK' as check_type,
  'model_versions' as table_name,
  COUNT(*)::text as null_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO NULL CREATORS - GOOD AUDIT TRAIL'
    WHEN COUNT(*) <= 10 THEN '⚠️  SOME NULL CREATORS (minor audit gap)'
    ELSE '❌ MANY NULL CREATORS - AUDIT TRAIL INCOMPLETE'
  END as status,
  CASE 
    WHEN COUNT(*) = 0 THEN 'All versions have creators tracked'
    ELSE 'Versions without created_by lack audit trail'
  END as details
FROM public.model_versions
WHERE created_by IS NULL;

-- ============================================================================
-- 4. LIST NULL CREATOR VERSIONS (if any exist)
-- ============================================================================

SELECT 
  'NULL CREATOR VERSIONS' as report_type,
  mv.id,
  mv.name as version_name,
  mv.status,
  m.name as model_name,
  mv.created_at
FROM public.model_versions mv
JOIN public.models m ON m.id = mv.model_id
WHERE mv.created_by IS NULL
ORDER BY mv.created_at DESC;

-- ============================================================================
-- 5. SUMMARY STATISTICS
-- ============================================================================

SELECT 
  'SUMMARY' as report_type,
  'Total Models' as metric,
  COUNT(*)::text as value
FROM public.models

UNION ALL

SELECT 
  'SUMMARY' as report_type,
  'Models with NULL owner' as metric,
  COUNT(*)::text
FROM public.models
WHERE owner_id IS NULL

UNION ALL

SELECT 
  'SUMMARY' as report_type,
  'Models with owners' as metric,
  COUNT(*)::text
FROM public.models
WHERE owner_id IS NOT NULL

UNION ALL

SELECT 
  'SUMMARY' as report_type,
  'Total Versions' as metric,
  COUNT(*)::text
FROM public.model_versions

UNION ALL

SELECT 
  'SUMMARY' as report_type,
  'Versions with NULL creator' as metric,
  COUNT(*)::text
FROM public.model_versions
WHERE created_by IS NULL

UNION ALL

SELECT 
  'SUMMARY' as report_type,
  'Versions with creators' as metric,
  COUNT(*)::text
FROM public.model_versions
WHERE created_by IS NOT NULL

ORDER BY metric;

-- ============================================================================
-- 6. FIX SCRIPT (if needed)
-- ============================================================================
-- If you find NULL owners, you can assign them to a user:
-- 
-- UPDATE public.models 
-- SET owner_id = 'USER_UUID_HERE'
-- WHERE owner_id IS NULL;
-- 
-- UPDATE public.model_versions
-- SET created_by = 'USER_UUID_HERE'
-- WHERE created_by IS NULL;

