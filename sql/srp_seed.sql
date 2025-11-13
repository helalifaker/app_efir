-- ============================================================================
-- School Relocation Planner - Seed Data
-- Version: 1.0
-- Date: 2025-11-13
-- ============================================================================
-- Test/demo data for School Relocation Planner features
-- Run this AFTER school_relocation_planner_migration.sql and srp_rls_policies.sql
-- ============================================================================

-- Note: This seed assumes you have at least one test version in model_versions
-- Replace VERSION_ID_HERE with actual version ID from your database

-- ============================================================================
-- 1. CAPEX RULES (Admin configuration)
-- ============================================================================

-- Building: 20-year cycle
INSERT INTO public.capex_rule (class, cycle_years, inflation_index, base_cost, trigger_type) VALUES
  ('Building', 20, 'cpi', 5000000.00, 'cycle')
ON CONFLICT DO NOTHING;

-- FF&E (Furniture, Fixtures & Equipment): 7-year cycle
INSERT INTO public.capex_rule (class, cycle_years, inflation_index, base_cost, trigger_type) VALUES
  ('FF&E', 7, 'cpi', 500000.00, 'cycle')
ON CONFLICT DO NOTHING;

-- IT: 4-year cycle
INSERT INTO public.capex_rule (class, cycle_years, inflation_index, base_cost, trigger_type) VALUES
  ('IT', 4, 'cpi', 250000.00, 'cycle')
ON CONFLICT DO NOTHING;

-- Other: 10-year cycle
INSERT INTO public.capex_rule (class, cycle_years, inflation_index, base_cost, trigger_type) VALUES
  ('Other', 10, 'cpi', 100000.00, 'cycle')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. SAMPLE CURRICULUM DATA
-- ============================================================================
-- This section requires a valid version_id
-- Uncomment and replace VERSION_ID_HERE after creating a test version

/*
-- French curriculum data (2023-2028 sample years)
DO $$
DECLARE
  v_version_id uuid := 'VERSION_ID_HERE'::uuid;
  v_year int;
BEGIN
  FOR v_year IN 2023..2028 LOOP
    INSERT INTO public.curriculum_plan (
      version_id,
      curriculum_type,
      year,
      capacity,
      students,
      tuition,
      teacher_ratio,
      non_teacher_ratio,
      cpi_frequency,
      cpi_base_year
    ) VALUES (
      v_version_id,
      'FR',
      v_year,
      500,  -- capacity
      450,  -- students (90% utilization)
      50000.00,  -- tuition SAR
      0.15,  -- teacher ratio (1 teacher per 6.67 students)
      0.08,  -- non-teacher ratio
      1,  -- CPI applied annually
      2023  -- base year
    )
    ON CONFLICT (version_id, curriculum_type, year) DO NOTHING;
  END LOOP;
END $$;

-- IB curriculum data (2023-2028 sample years)
DO $$
DECLARE
  v_version_id uuid := 'VERSION_ID_HERE'::uuid;
  v_year int;
BEGIN
  FOR v_year IN 2023..2028 LOOP
    INSERT INTO public.curriculum_plan (
      version_id,
      curriculum_type,
      year,
      capacity,
      students,
      tuition,
      teacher_ratio,
      non_teacher_ratio,
      cpi_frequency,
      cpi_base_year
    ) VALUES (
      v_version_id,
      'IB',
      v_year,
      300,  -- capacity
      270,  -- students (90% utilization)
      75000.00,  -- tuition SAR (higher than FR)
      0.18,  -- teacher ratio (more teachers per student)
      0.10,  -- non-teacher ratio
      1,  -- CPI applied annually
      2023  -- base year
    )
    ON CONFLICT (version_id, curriculum_type, year) DO NOTHING;
  END LOOP;
END $$;
*/

-- ============================================================================
-- 3. SAMPLE RENT DATA
-- ============================================================================
-- Uncomment and replace VERSION_ID_HERE after creating a test version

/*
-- Historical rent (2023-2024): Fixed amount
DO $$
DECLARE
  v_version_id uuid := 'VERSION_ID_HERE'::uuid;
BEGIN
  INSERT INTO public.rent_plan (version_id, year, model_type, amount, model_config) VALUES
    (v_version_id, 2023, NULL, 3000000.00, NULL),  -- 2024A actuals
    (v_version_id, 2024, NULL, 3000000.00, NULL);  -- 2024A actuals
END $$;

-- Transition years (2025-2027): Clone 2024A rent
DO $$
DECLARE
  v_version_id uuid := 'VERSION_ID_HERE'::uuid;
  v_year int;
BEGIN
  FOR v_year IN 2025..2027 LOOP
    INSERT INTO public.rent_plan (version_id, year, model_type, amount, model_config) VALUES
      (v_version_id, v_year, NULL, 3000000.00, NULL);  -- Clone from 2024A
  END LOOP;
END $$;

-- Relocation year 2028+: FixedEscalation model (3% annual)
DO $$
DECLARE
  v_version_id uuid := 'VERSION_ID_HERE'::uuid;
  v_year int;
  v_config jsonb := '{"baseRent": 5000000, "escalationRate": 0.03, "escalationFrequency": 1}'::jsonb;
BEGIN
  FOR v_year IN 2028..2052 LOOP
    INSERT INTO public.rent_plan (version_id, year, model_type, amount, model_config) VALUES
      (v_version_id, v_year, 'FixedEscalation', 5000000.00, v_config);
    -- Note: amount will be recalculated based on escalation
  END LOOP;
END $$;
*/

-- ============================================================================
-- 4. SAMPLE OPEX DATA
-- ============================================================================
-- Uncomment and replace VERSION_ID_HERE after creating a test version

/*
-- Simple opex structure: 25% of revenue
INSERT INTO public.opex_plan (version_id, sub_account, pct_of_revenue, amount) VALUES
  ('VERSION_ID_HERE'::uuid, NULL, 25.00, 0);  -- amount calculated from revenue

-- OR with sub-accounts (must sum to 100%):
INSERT INTO public.opex_plan (version_id, sub_account, pct_of_revenue, amount) VALUES
  ('VERSION_ID_HERE'::uuid, 'Marketing', 5.00, 0),
  ('VERSION_ID_HERE'::uuid, 'Administration', 10.00, 0),
  ('VERSION_ID_HERE'::uuid, 'Facilities', 8.00, 0),
  ('VERSION_ID_HERE'::uuid, 'Other', 2.00, 0);
*/

-- ============================================================================
-- 5. SAMPLE TUITION SIMULATION
-- ============================================================================
-- Uncomment and replace VERSION_ID_HERE after creating a test version

/*
-- Sample tuition simulation: 10% increase for both curricula
INSERT INTO public.tuition_simulation (
  version_id,
  rent_model_type,
  adjustment_factor_fr,
  adjustment_factor_ib,
  target_margin,
  target_ebitda,
  results
) VALUES (
  'VERSION_ID_HERE'::uuid,
  'FixedEscalation',
  10.00,  -- 10% tuition increase for FR
  10.00,  -- 10% tuition increase for IB
  0.25,   -- Target 25% EBITDA margin
  NULL,   -- Or specify absolute target
  '{
    "years": [2028, 2029, 2030],
    "revenue": [50000000, 52000000, 54000000],
    "rent": [5000000, 5150000, 5304500],
    "ebitda": [12500000, 13000000, 13500000],
    "rentLoadPct": [10.0, 9.9, 9.8]
  }'::jsonb
);
*/

-- ============================================================================
-- HELPER: Create a test version with School Relocation Planner data
-- ============================================================================
-- Uncomment this to create a complete test version

/*
DO $$
DECLARE
  v_model_id uuid;
  v_version_id uuid;
  v_year int;
BEGIN
  -- 1. Create test model (if not exists)
  INSERT INTO public.models (name, description, owner_id)
  VALUES ('School Relocation Test', 'Test model for School Relocation Planner', NULL)
  RETURNING id INTO v_model_id;

  -- 2. Create test version
  INSERT INTO public.model_versions (model_id, name, status, created_by)
  VALUES (v_model_id, 'V1 - Baseline', 'Draft', NULL)
  RETURNING id INTO v_version_id;

  -- 3. Add curriculum data (French)
  FOR v_year IN 2023..2028 LOOP
    INSERT INTO public.curriculum_plan (
      version_id, curriculum_type, year, capacity, students,
      tuition, teacher_ratio, non_teacher_ratio, cpi_frequency, cpi_base_year
    ) VALUES (
      v_version_id, 'FR', v_year, 500, 450,
      50000.00, 0.15, 0.08, 1, 2023
    );
  END LOOP;

  -- 4. Add curriculum data (IB)
  FOR v_year IN 2023..2028 LOOP
    INSERT INTO public.curriculum_plan (
      version_id, curriculum_type, year, capacity, students,
      tuition, teacher_ratio, non_teacher_ratio, cpi_frequency, cpi_base_year
    ) VALUES (
      v_version_id, 'IB', v_year, 300, 270,
      75000.00, 0.18, 0.10, 1, 2023
    );
  END LOOP;

  -- 5. Add rent data
  FOR v_year IN 2023..2027 LOOP
    INSERT INTO public.rent_plan (version_id, year, model_type, amount)
    VALUES (v_version_id, v_year, NULL, 3000000.00);
  END LOOP;

  FOR v_year IN 2028..2052 LOOP
    INSERT INTO public.rent_plan (version_id, year, model_type, amount, model_config)
    VALUES (
      v_version_id, v_year, 'FixedEscalation', 5000000.00,
      '{"baseRent": 5000000, "escalationRate": 0.03, "escalationFrequency": 1}'::jsonb
    );
  END LOOP;

  -- 6. Add opex plan
  INSERT INTO public.opex_plan (version_id, sub_account, pct_of_revenue, amount)
  VALUES (v_version_id, NULL, 25.00, 0);

  RAISE NOTICE 'Test version created with ID: %', v_version_id;
  RAISE NOTICE 'Use this ID to test School Relocation Planner features';
END $$;
*/

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Count records by table
/*
SELECT
  'curriculum_plan' as table_name, COUNT(*) as record_count FROM public.curriculum_plan
UNION ALL
SELECT 'rent_plan', COUNT(*) FROM public.rent_plan
UNION ALL
SELECT 'capex_rule', COUNT(*) FROM public.capex_rule
UNION ALL
SELECT 'opex_plan', COUNT(*) FROM public.opex_plan
UNION ALL
SELECT 'tuition_simulation', COUNT(*) FROM public.tuition_simulation;
*/

-- View curriculum summary by version
/*
SELECT
  v.name as version_name,
  cp.curriculum_type,
  COUNT(DISTINCT cp.year) as years_planned,
  AVG(cp.capacity) as avg_capacity,
  AVG(cp.students) as avg_students
FROM public.curriculum_plan cp
JOIN public.model_versions v ON v.id = cp.version_id
GROUP BY v.name, cp.curriculum_type
ORDER BY v.name, cp.curriculum_type;
*/

-- ============================================================================
-- SEED DATA COMPLETE
-- ============================================================================
-- Next steps:
-- 1. Uncomment sections above and replace VERSION_ID_HERE
-- 2. Or use the helper script to create a complete test version
-- 3. Test API endpoints with this data
-- ============================================================================
