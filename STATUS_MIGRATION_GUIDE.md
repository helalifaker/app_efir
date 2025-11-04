# Status Migration Guide - Fixing Constraint Violations

## Problem

The database constraint expects capitalized status values (`Draft`, `Ready`, `Locked`, `Archived`), but some code is still using lowercase values (`draft`, `ready`, `locked`), causing constraint violations.

## Immediate Fix

**Run this SQL script FIRST** to fix existing data:

```sql
-- File: sql/phase1_emergency_fix.sql
```

This will:
1. Drop the constraint temporarily
2. Fix ALL invalid status values in the database
3. Normalize all lowercase statuses to capitalized
4. Re-apply the constraint

## Code Fixes Applied

The following files have been updated to use capitalized statuses:

✅ `app/api/versions/[id]/status/route.ts` - Status API
✅ `app/api/versions/[id]/clone/route.ts` - Clone creates with "Draft"
✅ `scripts/seed-test-data.ts` - Test data uses "Draft" and "Ready"
✅ `scripts/test-helpers.ts` - Helper function updated
✅ `e2e/version-flow.spec.ts` - E2E test helper updated
✅ `lib/schemas/timeseries.ts` - Dashboard query schema updated
✅ `app/api/dashboard-v2/route.ts` - Status filters updated
✅ `app/api/timeseries/metrics/route.ts` - Locked check updated

## Still Need Updates (Frontend/UI)

These files still use lowercase statuses but won't cause database errors (they're read-only or for display):

⚠️ `app/version-detail/[id]/ActionsBar.tsx` - UI component (needs update)
⚠️ `app/version-detail/[id]/page.tsx` - Display logic (needs update)
⚠️ `app/version-detail/[id]/ExportButton.tsx` - Display check (needs update)

These should be updated to handle capitalized statuses for proper UI display.

## Verification

After running the emergency fix, verify with:

```sql
-- Should return 0 rows
SELECT id, name, status
FROM public.model_versions
WHERE status NOT IN ('Draft', 'Ready', 'Locked', 'Archived');

-- Should show only valid statuses
SELECT status, COUNT(*) 
FROM public.model_versions 
GROUP BY status;
```

## Next Steps

1. ✅ Run `sql/phase1_emergency_fix.sql` in Supabase
2. ✅ Verify all statuses are valid
3. ⚠️ Update frontend components to display capitalized statuses
4. ✅ Test all status transitions

