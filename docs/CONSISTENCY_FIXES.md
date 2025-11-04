# Consistency Fixes Applied

**Date**: Current  
**Status**: ✅ **FIXED**

---

## Fixes Applied

### 1. ✅ Fixed Status Constraint in `schema.sql`

**Changed**: Line 40
- **Before**: `CHECK (status IN ('draft', 'ready', 'locked'))`
- **After**: `CHECK (status IN ('Draft', 'Ready', 'Locked', 'Archived'))`

**Impact**: Base schema now matches all migrations and application code.

---

### 2. ✅ Fixed Status History Constraints in `schema.sql`

**Changed**: Lines 92-93
- **Before**: 
  - `old_status text CHECK (old_status IN ('draft', 'ready', 'locked'))`
  - `new_status text NOT NULL CHECK (new_status IN ('draft', 'ready', 'locked'))`
- **After**:
  - `old_status text CHECK (old_status IN ('Draft', 'Ready', 'Locked', 'Archived') OR old_status IS NULL)`
  - `new_status text NOT NULL CHECK (new_status IN ('Draft', 'Ready', 'Locked', 'Archived'))`

**Impact**: Status history now supports capitalized statuses and Archived.

---

### 3. ✅ Fixed Severity Constraint in `schema.sql`

**Changed**: Line 79
- **Before**: `CHECK (severity IN ('error', 'warning'))`
- **After**: `CHECK (severity IN ('error', 'warning', 'critical', 'major', 'minor'))`

**Impact**: Validation table now supports all severity levels used by the application.

---

### 4. ✅ Added Missing Columns to `model_versions` in `schema.sql`

**Added**: Lines 42-45
- `override_flag boolean NOT NULL DEFAULT false`
- `override_reason text`
- `override_by uuid`
- `archived_at timestamptz`

**Impact**: Base schema now includes all Phase 1 columns.

---

### 5. ✅ Added Missing Indexes in `schema.sql`

**Added**: Lines 54-55
- `idx_model_versions_override_flag`
- `idx_model_versions_archived_at`

**Impact**: Proper indexing for Phase 1 features.

---

## Verification

All inconsistencies have been fixed. The base `schema.sql` now matches:
- ✅ All migration scripts
- ✅ Application code (TypeScript types)
- ✅ API routes
- ✅ All verification scripts

---

## Note on `version_audit` Table

The `version_audit` table is intentionally **not** in the base `schema.sql` because:
- It's created by `phase1_status_model.sql` migration
- It's part of Phase 1 enhancements, not base schema
- This is correct - migrations should add it, not base schema

---

## Summary

**Total Issues Found**: 3 critical inconsistencies  
**Total Issues Fixed**: 3 ✅

The database schema is now fully consistent across all files.

