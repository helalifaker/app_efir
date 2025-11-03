# RLS Implementation Summary

## Overview

EFIR now has **Row-Level Security (RLS)** enabled on all data tables. This document summarizes what was implemented and how it works.

## Files Created

### SQL Files

1. **`sql/schema.sql`** - Complete database schema
   - Creates all tables (models, model_versions, version_tabs, etc.)
   - Sets up indexes and constraints
   - Seeds default app_settings

2. **`sql/rls_policies.sql`** - Security policies
   - Enables RLS on all data tables
   - Creates ownership-based policies
   - Helper functions for ownership checks

3. **`sql/seed.sql`** - Test data
   - Creates a sample model and version
   - Adds all 6 tabs with realistic data
   - Includes validations and history

### Documentation

1. **`docs/security.md`** - Comprehensive security guide
   - Explains RLS strategy
   - Service role vs anon key
   - Attack vector analysis
   - Best practices

2. **`docs/setup.md`** - Setup instructions
   - Step-by-step database setup
   - Local development
   - Vercel deployment

3. **`docs/deploy.md`** - Updated deployment guide
   - Now includes RLS verification steps

4. **`README.md`** - Updated with new structure

## RLS Strategy

### Table Coverage

| Table | RLS Enabled | Policy Type |
|-------|-------------|-------------|
| `models` | ✅ Yes | Owner-based |
| `model_versions` | ✅ Yes | Inherits from models |
| `version_tabs` | ✅ Yes | Cascades through versions |
| `version_validations` | ✅ Yes | Cascades through versions |
| `version_status_history` | ✅ Yes | Cascades, no UPDATE/DELETE |
| `app_settings` | ❌ No | Public read, service write |

### Access Model

- **Read**: Users can only see their own models/versions
- **Write**: Only owners can create/update/delete
- **Exceptions**: Models with `owner_id = NULL` are readable by all (for testing)
- **Service Role**: Bypasses all RLS (used by API routes)

### Helper Functions

```sql
-- Check if user owns a model
user_owns_model(model_id, user_id)

-- Get model_id from version_id
get_model_id_from_version(version_id)
```

## API Routes Status

All API routes already use service role and **require no changes**:

| Route | Status | Notes |
|-------|--------|-------|
| `/api/settings` | ✅ Service role | Works with RLS |
| `/api/versions/[id]/clone` | ✅ Service role | Works with RLS |
| `/api/versions/[id]/status` | ✅ Service role | Works with RLS |
| `/api/versions/[id]/validate` | ✅ Service role | Works with RLS |
| `/api/versions/[id]/history` | ✅ Service role | Works with RLS |
| `/api/compare/*` | ✅ Service role | Works with RLS |

## Setup Order

**IMPORTANT**: Run SQL scripts in this order:

1. `sql/schema.sql` - Creates tables
2. `sql/rls_policies.sql` - Enables RLS
3. `sql/seed.sql` - Optional test data

Running `rls_policies.sql` before `schema.sql` will fail because tables don't exist yet.

## Testing RLS

### Verify RLS is Enabled

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

Expected: All tables show `rowsecurity = true` except `app_settings`.

### Test Client-Side Restriction

```javascript
// Browser console (authenticated as User A)
const { data } = await supabase.from('models').select('*');
// Should only return models owned by User A
```

### Test Service Role Bypass

```javascript
// Server-side API route
const supabase = getServiceClient();
const { data } = await supabase.from('models').select('*');
// Returns ALL models (no RLS)
```

## Migration Notes

### Existing Deployments

If you already have data:

1. Run `sql/schema.sql` to ensure all tables exist
2. Run `sql/rls_policies.sql` to enable RLS
3. **Verify** no access issues with existing data
4. Optionally update `owner_id` values from NULL to real user IDs

### NULL Owners

Models with `owner_id = NULL` are **readable by all authenticated users**. This is intentional for:
- Development/testing
- Shared demo models
- Migration scenarios

In production, set real `owner_id` values.

## Security Checklist

- [x] RLS enabled on all data tables
- [x] Service role never exposed to client
- [x] API routes use service role
- [x] Helper functions for ownership checks
- [x] Documentation complete
- [x] Build passes with RLS
- [x] No functional changes required in app code

## Next Steps (Optional)

Consider adding:
- Admin role with full access
- Read-only role for reports
- Team sharing (multiple owners per model)
- Audit logging of policy violations

These are **not required** for current functionality.

## References

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [EFIR Security Guide](./security.md)
- [EFIR Setup Guide](./setup.md)

