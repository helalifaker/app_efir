-- Fix invalid UUID format in existing data
-- This script creates a new version with valid UUID and moves all data

BEGIN;

-- Step 1: Create new version record with valid UUID (copy all data from old one)
INSERT INTO public.model_versions (id, model_id, name, status, created_by, created_at, updated_at)
SELECT 
  '22222222-2222-2222-8222-222222222222'::uuid,
  model_id,
  name,
  status,
  created_by,
  created_at,
  updated_at
FROM public.model_versions
WHERE id = '22222222-2222-2222-2222-222222222222'::uuid
ON CONFLICT (id) DO NOTHING;

-- Step 2: Update child tables to reference new UUID
UPDATE public.version_tabs 
SET version_id = '22222222-2222-2222-8222-222222222222'::uuid
WHERE version_id = '22222222-2222-2222-2222-222222222222'::uuid;

UPDATE public.version_validations 
SET version_id = '22222222-2222-2222-8222-222222222222'::uuid
WHERE version_id = '22222222-2222-2222-2222-222222222222'::uuid;

UPDATE public.version_status_history 
SET version_id = '22222222-2222-2222-8222-222222222222'::uuid
WHERE version_id = '22222222-2222-2222-2222-222222222222'::uuid;

-- Step 3: Delete old version (now safe because no foreign keys reference it)
DELETE FROM public.model_versions 
WHERE id = '22222222-2222-2222-2222-222222222222'::uuid;

-- Verify the update
SELECT 
  'Updated version ID' as info,
  id,
  name,
  status,
  created_at
FROM public.model_versions
WHERE id = '22222222-2222-2222-8222-222222222222'::uuid;

SELECT 
  'Version tabs count' as info,
  COUNT(*) as count
FROM public.version_tabs
WHERE version_id = '22222222-2222-2222-8222-222222222222'::uuid;

SELECT 
  'Validations count' as info,
  COUNT(*) as count
FROM public.version_validations
WHERE version_id = '22222222-2222-2222-8222-222222222222'::uuid;

SELECT 
  'History count' as info,
  COUNT(*) as count
FROM public.version_status_history
WHERE version_id = '22222222-2222-2222-8222-222222222222'::uuid;

COMMIT;
