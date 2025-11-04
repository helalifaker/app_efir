# Database Schema Consistency Report

**Date**: Current  
**Status**: ⚠️ **INCONSISTENCIES FOUND**

---

## 🔴 Critical Inconsistencies

### 1. **Status Values in `schema.sql` vs Migrations**

**Issue**: Base schema uses lowercase statuses, but all migrations and code use capitalized.

**File**: `sql/schema.sql` (Line 40)
```sql
status text NOT NULL CHECK (status IN ('draft', 'ready', 'locked')),
```

**Expected** (from `phase1_status_model.sql`):
```sql
CHECK (status IN ('Draft', 'Ready', 'Locked', 'Archived'))
```

**Impact**: 
- If someone runs `schema.sql` on a fresh database, they'll get lowercase statuses
- All application code expects capitalized statuses
- Migration scripts will fail if run after fresh schema.sql

**Fix Required**: Update `schema.sql` line 40 to use capitalized statuses + Archived

---

### 2. **Status History Constraints in `schema.sql`**

**Issue**: Base schema uses lowercase statuses in history table.

**File**: `sql/schema.sql` (Lines 88-89)
```sql
old_status text CHECK (old_status IN ('draft', 'ready', 'locked')),
new_status text NOT NULL CHECK (new_status IN ('draft', 'ready', 'locked')),
```

**Expected** (from `phase1_status_model.sql`):
```sql
old_status text CHECK (old_status IN ('Draft', 'Ready', 'Locked', 'Archived') OR old_status IS NULL),
new_status text CHECK (new_status IN ('Draft', 'Ready', 'Locked', 'Archived')),
```

**Impact**: Same as above - fresh installs will have wrong constraints

**Fix Required**: Update `schema.sql` lines 88-89

---

### 3. **Severity Values in `schema.sql`**

**Issue**: Base schema only has 2 severity values, but application expects 5.

**File**: `sql/schema.sql` (Line 75)
```sql
severity text NOT NULL CHECK (severity IN ('error', 'warning')),
```

**Expected** (from `COMPLETE_MIGRATION.sql`):
```sql
severity text NOT NULL CHECK (severity IN ('error', 'warning', 'critical', 'major', 'minor')),
```

**Impact**: 
- Dashboard and validation code expects 'critical', 'major', 'minor'
- Fresh installs will reject valid severity values

**Fix Required**: Update `schema.sql` line 75

---

## ✅ Consistent (No Issues)

### 1. **TypeScript Types**
- ✅ `types/index.ts` correctly uses: `'Draft' | 'Ready' | 'Locked' | 'Archived'`
- ✅ All application code uses capitalized statuses
- ✅ Status references in code match TypeScript types

### 2. **Migration Scripts**
- ✅ `phase1_status_model.sql` correctly uses capitalized statuses
- ✅ `COMPLETE_MIGRATION.sql` correctly uses capitalized statuses
- ✅ All verification scripts expect capitalized statuses

### 3. **RLS Policies**
- ✅ All RLS policies are consistent across files
- ✅ Time-series tables have RLS enabled
- ✅ Ownership-based access control is consistent

### 4. **Table Definitions**
- ✅ All table structures are consistent
- ✅ Foreign key relationships are consistent
- ✅ Indexes are properly defined

---

## 📋 Recommended Fixes

### Fix 1: Update `schema.sql` Status Constraint

**File**: `sql/schema.sql`

**Change Line 40**:
```sql
-- OLD (WRONG):
status text NOT NULL CHECK (status IN ('draft', 'ready', 'locked')),

-- NEW (CORRECT):
status text NOT NULL CHECK (status IN ('Draft', 'Ready', 'Locked', 'Archived')),
```

**Change Lines 88-89**:
```sql
-- OLD (WRONG):
old_status text CHECK (old_status IN ('draft', 'ready', 'locked')),
new_status text NOT NULL CHECK (new_status IN ('draft', 'ready', 'locked')),

-- NEW (CORRECT):
old_status text CHECK (old_status IN ('Draft', 'Ready', 'Locked', 'Archived') OR old_status IS NULL),
new_status text NOT NULL CHECK (new_status IN ('Draft', 'Ready', 'Locked', 'Archived')),
```

### Fix 2: Update `schema.sql` Severity Constraint

**File**: `sql/schema.sql`

**Change Line 75**:
```sql
-- OLD (WRONG):
severity text NOT NULL CHECK (severity IN ('error', 'warning')),

-- NEW (CORRECT):
severity text NOT NULL CHECK (severity IN ('error', 'warning', 'critical', 'major', 'minor')),
```

### Fix 3: Add Missing Columns to `schema.sql`

**File**: `sql/schema.sql`

**Add after line 43** (in `model_versions` table):
```sql
override_flag boolean NOT NULL DEFAULT false,
override_reason text,
override_by uuid,
archived_at timestamptz,
```

---

## 🎯 Impact Assessment

### Current State
- ✅ **Production databases** are fine (migrations have been applied)
- ⚠️ **Fresh installs** using `schema.sql` will have inconsistencies
- ⚠️ **Documentation** shows wrong status values

### After Fix
- ✅ Fresh installs will work correctly
- ✅ Schema matches all migrations
- ✅ Code and database are fully aligned

---

## 📝 Summary

**Total Issues Found**: 3 critical inconsistencies

1. Status constraint in `schema.sql` (lowercase vs capitalized)
2. Status history constraints in `schema.sql` (lowercase vs capitalized)
3. Severity constraint in `schema.sql` (2 values vs 5 values)

**All Other Files**: ✅ Consistent

**Fix Priority**: 🔴 **HIGH** - Should be fixed before any new deployments

---

**Next Steps**:
1. Update `sql/schema.sql` with the fixes above
2. Test fresh install using only `schema.sql`
3. Verify all constraints match migrations

