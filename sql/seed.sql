-- EFIR Seed Data
-- Run this AFTER schema.sql and rls_policies.sql

-- ============================================================================
-- 1. CREATE A TEST USER (if auth.users exists)
-- ============================================================================
-- Note: In production, use real authentication
-- This creates a test profile entry

DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Try to get an existing user
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'No users found in auth.users. Creating model without owner_id.';
  ELSE
    RAISE NOTICE 'Using existing user: %', test_user_id;
    
    -- Ensure profiles entry exists
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (test_user_id, 'admin@efir.test', 'EFIR Admin', 'admin')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  -- Create test model (with or without owner)
  INSERT INTO public.models (id, name, description, owner_id) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Finance App Demo', 'Main financial model for testing', test_user_id)
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
END $$;

-- ============================================================================
-- 2. VERIFY MODEL WAS CREATED
-- ============================================================================
SELECT 'Models' as table_name, COUNT(*) as count FROM public.models;

-- ============================================================================
-- 3. CREATE A TEST VERSION
-- ============================================================================
-- Note: Using valid UUID format (4th segment must start with 8, 9, a, or b)
INSERT INTO public.model_versions (id, model_id, name, status, created_by) VALUES
  ('22222222-2222-2222-8222-222222222222', '11111111-1111-1111-1111-111111111111', 'Baseline 2026', 'draft', NULL)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
RETURNING *;

-- ============================================================================
-- 4. ADD ALL TABS WITH SAMPLE DATA
-- ============================================================================
INSERT INTO public.version_tabs (version_id, tab, data) VALUES
  ('22222222-2222-2222-8222-222222222222', 'overview', '{"summary": "Baseline version of 2026"}'::jsonb),
  ('22222222-2222-2222-8222-222222222222', 'pnl', '{"revenue": 500000, "ebit": 100000, "net_income": 75000, "students_count": 100, "avg_tuition_fee": 5000, "other_income": {"grants": 100000}}'::jsonb),
  ('22222222-2222-2222-8222-222222222222', 'bs', '{"assets": 1000000, "equity": 250000, "liabilities": 750000}'::jsonb),
  -- Note: 1,000,000 = 250,000 + 750,000 ✓ (balanced)
  ('22222222-2222-2222-8222-222222222222', 'cf', '{"operating": 80000, "investing": -50000, "financing": -20000}'::jsonb),
  ('22222222-2222-2222-8222-222222222222', 'capex', '{"projects": [{"name": "Factory Upgrade", "amount": 120000}]}'::jsonb),
  ('22222222-2222-2222-8222-222222222222', 'controls', '{"status": "OK", "last_check": "2025-11-01"}'::jsonb)
ON CONFLICT (version_id, tab) DO UPDATE SET data = EXCLUDED.data;

-- ============================================================================
-- 5. ADD A VALIDATION ERROR (optional - comment out to allow ready status)
-- ============================================================================
-- INSERT INTO public.version_validations (version_id, code, message, severity) VALUES
--   ('22222222-2222-2222-8222-222222222222', 'BS_NOT_BALANCED', 'Balance sheet does not balance by 1,250', 'error')
-- ON CONFLICT DO NOTHING;
-- Note: Commented out so the version can be set to "ready" status

-- ============================================================================
-- 6. ADD STATUS HISTORY
-- ============================================================================
INSERT INTO public.version_status_history (version_id, old_status, new_status, changed_by, note) VALUES
  ('22222222-2222-2222-8222-222222222222', NULL, 'draft', NULL, 'Version created')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. VERIFY DATA
-- ============================================================================
SELECT 
  'Version' as item,
  '22222222-2222-2222-8222-222222222222' as id,
  COUNT(*) FILTER (WHERE severity = 'error') as errors,
  COUNT(*) FILTER (WHERE severity = 'warning') as warnings
FROM public.version_validations
WHERE version_id = '22222222-2222-2222-8222-222222222222';

SELECT 'Status history entries' as info, COUNT(*) FROM public.version_status_history 
WHERE version_id = '22222222-2222-2222-8222-222222222222';

-- ============================================================================
-- DONE! Seed data created.
-- ============================================================================

