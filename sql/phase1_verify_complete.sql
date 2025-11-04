-- Phase 1: Verification Script
-- Run this AFTER phase1_emergency_fix.sql to verify everything is correct

-- ============================================================================
-- VERIFICATION CHECKS
-- ============================================================================

-- 1. Check all model_versions have valid statuses
SELECT 
  'model_versions status check' as check_name,
  COUNT(*) FILTER (WHERE status IN ('Draft', 'Ready', 'Locked', 'Archived')) as valid_count,
  COUNT(*) FILTER (WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) as invalid_count,
  COUNT(*) as total_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) = 0 
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result
FROM public.model_versions;

-- 2. Check status history has valid statuses
SELECT 
  'version_status_history check' as check_name,
  COUNT(*) FILTER (WHERE new_status IN ('Draft', 'Ready', 'Locked', 'Archived')) as valid_new_status_count,
  COUNT(*) FILTER (WHERE new_status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) as invalid_new_status_count,
  COUNT(*) FILTER (WHERE old_status IS NULL OR old_status IN ('Draft', 'Ready', 'Locked', 'Archived')) as valid_old_status_count,
  COUNT(*) FILTER (WHERE old_status IS NOT NULL AND old_status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) as invalid_old_status_count,
  COUNT(*) as total_count,
  CASE 
    WHEN COUNT(*) FILTER (WHERE new_status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) = 0
    AND COUNT(*) FILTER (WHERE old_status IS NOT NULL AND old_status NOT IN ('Draft', 'Ready', 'Locked', 'Archived')) = 0
    THEN '✅ PASS' 
    ELSE '❌ FAIL' 
  END as result
FROM public.version_status_history;

-- 3. Check constraint exists
SELECT 
  'constraint check' as check_name,
  conname as constraint_name,
  CASE 
    WHEN conname = 'model_versions_status_check' THEN '✅ EXISTS'
    ELSE '❌ MISSING'
  END as result
FROM pg_constraint
WHERE conrelid = 'public.model_versions'::regclass
  AND conname = 'model_versions_status_check';

-- 4. Show status distribution
SELECT 
  'status distribution' as info,
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.model_versions
GROUP BY status
ORDER BY status;

-- 5. Check override flags
SELECT 
  'override flags' as info,
  override_flag,
  COUNT(*) as count
FROM public.model_versions
GROUP BY override_flag
ORDER BY override_flag;

-- 6. Check archived versions
SELECT 
  'archived versions' as info,
  COUNT(*) FILTER (WHERE status = 'Archived') as archived_count,
  COUNT(*) FILTER (WHERE archived_at IS NOT NULL) as has_archived_at_count,
  COUNT(*) FILTER (WHERE status = 'Archived' AND archived_at IS NULL) as missing_archived_at
FROM public.model_versions;

-- 7. Final summary
SELECT 
  '✅ VERIFICATION COMPLETE' as summary,
  (SELECT COUNT(*) FROM public.model_versions WHERE status IN ('Draft', 'Ready', 'Locked', 'Archived')) as valid_status_count,
  (SELECT COUNT(*) FROM public.model_versions) as total_versions,
  (SELECT COUNT(*) FROM public.model_versions WHERE override_flag = true) as override_count,
  (SELECT COUNT(*) FROM public.model_versions WHERE status = 'Archived') as archived_count;

