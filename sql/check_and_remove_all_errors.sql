-- Check what validation errors exist
SELECT 
  id,
  code,
  message,
  severity,
  created_at
FROM public.version_validations
WHERE version_id = '22222222-2222-2222-8222-222222222222'::uuid
  AND severity = 'error';

-- Remove ALL validation errors for this version
DELETE FROM public.version_validations
WHERE version_id = '22222222-2222-2222-8222-222222222222'::uuid
  AND severity = 'error';

-- Verify all errors are gone
SELECT 
  'Remaining validation errors' as info,
  COUNT(*) as error_count
FROM public.version_validations
WHERE version_id = '22222222-2222-2222-8222-222222222222'::uuid
  AND severity = 'error';

-- Show remaining warnings (if any)
SELECT 
  'Remaining validation warnings' as info,
  COUNT(*) as warning_count
FROM public.version_validations
WHERE version_id = '22222222-2222-2222-8222-222222222222'::uuid
  AND severity = 'warning';

