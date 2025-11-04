# Supabase Migration Checklist

## Required Migrations (Run in Order)

This checklist covers all migrations needed for the complete application. Run them **in order** in the Supabase SQL Editor.

### ✅ Base Schema (If starting fresh)

1. **`sql/schema.sql`** - Base tables (models, model_versions, version_tabs, etc.)
2. **`sql/rls_policies.sql`** - Row Level Security policies

### ✅ Time-Series Schema (Phase 1 - Required)

3. **`sql/timeseries_schema.sql`** - Time-series tables:
   - `admin_config` - Admin configuration
   - `version_metrics` - Time-series metrics (2023-2052)
   - `version_computed` - Computed metrics cache

### ✅ Status Model Updates (Phase 1 - Required)

4. **`sql/phase1_status_model.sql`** - Status model enhancements:
   - Adds `Archived` status
   - Capitalizes all status values (Draft, Ready, Locked, Archived)
   - Adds `override_flag`, `override_reason`, `override_by`, `archived_at` fields
   - Creates `version_audit` table for status transitions
   - Adds transition validation functions

   **Note**: If you get constraint errors, run `sql/phase1_emergency_fix.sql` first to clean up existing data.

### ✅ Data Model Completion (Phase 2 - Required)

5. **`sql/phase2_data_model.sql`** - Data model tables:
   - `metric_catalog` - Metric metadata catalog
   - `version_statement_lines` - Structured statement lines
   - Seeds all 31 metrics in metric_catalog

6. **`sql/phase2_rls_policies.sql`** - RLS policies for Phase 2 tables:
   - `metric_catalog` - Public read, service role write
   - `version_statement_lines` - Owner-based access

### ✅ Optional: Performance Indexes

7. **`sql/perf_indexes.sql`** - Performance indexes (optional but recommended)

### ✅ Optional: Test Data

8. **`sql/seed.sql`** - Test data (optional, for development)

---

## Migration Order Summary

```
1. sql/schema.sql                    (Base tables)
2. sql/rls_policies.sql             (Base RLS)
3. sql/timeseries_schema.sql         (Time-series)
4. sql/phase1_status_model.sql      (Status model)
   [If errors: sql/phase1_emergency_fix.sql]
5. sql/phase2_data_model.sql        (Metric catalog, statement lines)
6. sql/phase2_rls_policies.sql      (Phase 2 RLS)
7. sql/perf_indexes.sql             (Optional)
8. sql/seed.sql                     (Optional)
```

---

## Verification Queries

After running migrations, verify with these queries:

### Check Tables Exist

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
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
ORDER BY table_name;
```

**Expected**: All 11 tables should exist.

### Check Status Values

```sql
SELECT DISTINCT status, COUNT(*) as count
FROM model_versions
GROUP BY status
ORDER BY status;
```

**Expected**: Status values should be capitalized: `Draft`, `Ready`, `Locked`, `Archived`

### Check Metric Catalog

```sql
SELECT COUNT(*) as total_metrics, 
       COUNT(DISTINCT category) as categories
FROM metric_catalog;
```

**Expected**: Should have 31 metrics across multiple categories.

### Check RLS Status

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'metric_catalog',
    'version_statement_lines'
  )
ORDER BY tablename;
```

**Expected**: Both tables should have `rowsecurity = true`.

### Check Functions

```sql
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN (
    'can_transition_status',
    'log_version_transition',
    'get_metric_metadata',
    'get_statement_metrics'
  )
ORDER BY routine_name;
```

**Expected**: All 4 functions should exist.

---

## Troubleshooting

### Error: Status constraint violation

**Solution**: Run `sql/phase1_emergency_fix.sql` to clean up invalid status values, then re-run `sql/phase1_status_model.sql`.

### Error: Table already exists

**Solution**: This is fine. The migrations use `CREATE TABLE IF NOT EXISTS`, so they're idempotent.

### Error: Function already exists

**Solution**: The functions use `CREATE OR REPLACE`, so they can be re-run safely.

### Missing metric_catalog data

**Solution**: Re-run `sql/phase2_data_model.sql`. The seed data uses `ON CONFLICT DO UPDATE`, so it's safe to re-run.

---

## Quick Migration Script

If you want to run everything at once (for a fresh database):

```sql
-- Run in Supabase SQL Editor
-- 1. Base schema
\i sql/schema.sql
\i sql/rls_policies.sql

-- 2. Time-series
\i sql/timeseries_schema.sql

-- 3. Status model
\i sql/phase1_status_model.sql

-- 4. Data model
\i sql/phase2_data_model.sql
\i sql/phase2_rls_policies.sql

-- 5. Optional
\i sql/perf_indexes.sql
```

**Note**: The `\i` command doesn't work in Supabase SQL Editor. You need to copy-paste each file's contents manually.

---

## Current Status

Based on our conversation:
- ✅ Phase 1 status model: Implemented
- ✅ Phase 2 data model: Implemented  
- ✅ Phase 2 RLS policies: Implemented
- ✅ Migration script: Created (`scripts/migrate-to-statement-lines.ts`)

**Action Required**: Run the SQL migrations listed above in Supabase SQL Editor if you haven't already.

