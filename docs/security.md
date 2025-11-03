# EFIR Security Documentation

## Overview

EFIR implements **Row Level Security (RLS)** on all data tables to ensure users can only access and modify their own financial models and versions.

## Authentication & Authorization

### RLS Strategy

- **Read Access**: Users can only view models and versions they own (via `owner_id` on `models`)
- **Write Access**: Only owners can create, update, or delete their data
- **Service Role**: Server-side API routes use `SUPABASE_SERVICE_ROLE_KEY` which **bypasses all RLS**
- **No Auth**: Models with `owner_id = NULL` are readable by all (for testing/development)

### Service Role Usage

All API routes use the service role key for database operations:

```typescript
// Server-side only
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // Bypasses RLS
);
```

This is **by design** because:
1. API routes run on Vercel server (never exposed to browser)
2. Business logic and validation happen server-side
3. Service role allows full access for legitimate operations
4. Client code uses `anon` key and is restricted by RLS

## Database Tables & Policies

### 1. Models (`public.models`)

- **Owner**: `owner_id` (UUID) → `auth.users(id)`
- **RLS**: Enabled
- **Policies**:
  - Read: Owner only (or NULL = readable by all)
  - Write: Owner only

**Example**:
```sql
-- User can only see their own models
SELECT * FROM models WHERE owner_id = auth.uid();
```

### 2. Model Versions (`public.model_versions`)

- **Parent**: `model_id` → `models(id)` (CASCADE delete)
- **RLS**: Enabled, inherits ownership from parent model
- **Policies**:
  - Read: If parent model owned by user
  - Write: If parent model owned by user

**Example**:
```sql
-- User can only see versions of their models
SELECT mv.* FROM model_versions mv
JOIN models m ON mv.model_id = m.id
WHERE m.owner_id = auth.uid();
```

### 3. Version Tabs (`public.version_tabs`)

- **Parent**: `version_id` → `model_versions(id)` (CASCADE delete)
- **RLS**: Enabled, cascades through versions → models
- **Policies**: Same as versions (inherit ownership)

### 4. Version Validations (`public.version_validations`)

- **Parent**: `version_id` → `model_versions(id)` (CASCADE delete)
- **RLS**: Enabled, cascades through versions → models
- **Policies**: Same as versions

### 5. Version Status History (`public.version_status_history`)

- **Parent**: `version_id` → `model_versions(id)` (CASCADE delete)
- **RLS**: Enabled, cascades through versions → models
- **Policies**: Read/Insert like versions, **NO UPDATE/DELETE** (historical record)

### 6. App Settings (`public.app_settings`)

- **RLS**: **DISABLED** (readable by all, writable via service role only)
- **Rationale**: Global application configuration

## Testing with NULL Owners

During development, you may create models with `owner_id = NULL`:

```sql
-- Create a test model (readable by all authenticated users)
INSERT INTO models (name, owner_id) VALUES ('Test Model', NULL);
```

**Important**: NULL-owned models are readable by ALL authenticated users. Set a real `owner_id` in production.

## Security Best Practices

### ✅ DO

1. **Always use service role key in API routes** (`SUPABASE_SERVICE_ROLE_KEY`)
2. **Never expose service role key to client** (check for `NEXT_PUBLIC_` prefix)
3. **Set real `owner_id` values in production**
4. **Keep service role key in Vercel environment variables** (never commit)
5. **Use `anon` key for client-side code** (automatically restricted by RLS)

### ❌ DON'T

1. **Don't use service role key in client components**
2. **Don't disable RLS in production** (unless you know what you're doing)
3. **Don't hardcode any keys in source code**
4. **Don't expose auth users IDs unnecessarily**

## Attack Vector Analysis

### Scenario 1: Malicious Client Tries to Read Others' Data

```javascript
// Client-side code (uses anon key)
const { data } = await supabase
  .from('models')
  .select('*')
  .eq('id', 'SOME_OTHER_USER_MODEL_ID');
```

**Result**: Empty result due to RLS policy checking `owner_id = auth.uid()`

### Scenario 2: Malicious Client Tries to Update Others' Data

```javascript
// Client-side code
const { error } = await supabase
  .from('models')
  .update({ name: 'Hacked!' })
  .eq('id', 'SOME_OTHER_USER_MODEL_ID');
```

**Result**: Update silently fails (0 rows affected) due to RLS

### Scenario 3: Authenticated API Call

All API routes use service role and bypass RLS. However, API routes should implement their own authorization if needed (e.g., check user role, verify ownership before operations).

**Current Implementation**: API routes trust RLS because server always uses service role. This is acceptable for single-tenant or basic multi-tenant scenarios.

## RLS Bypass (Service Role)

The service role key has **UNLIMITED ACCESS** to all tables, regardless of RLS:

```typescript
// This will ALWAYS work (no RLS restriction)
const supabase = createClient(url, SERVICE_ROLE_KEY);
const { data } = await supabase.from('models').select('*');
// Returns ALL models, regardless of owner_id
```

This is why `SUPABASE_SERVICE_ROLE_KEY` must **never** be exposed to the browser.

## Environment Variables

### Required

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...     # Public (RLS enforced)
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...         # SECRET! Never expose
```

### Where Used

| Variable | Used In | RLS Enforced |
|----------|---------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client, Server | N/A |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-side code | ✅ Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server API routes only | ❌ No |

## Verifying RLS Works

### Test 1: Read Protection

```sql
-- In Supabase SQL Editor (authenticated as User A)
SELECT * FROM models WHERE owner_id = 'USER_B_UUID';
-- Should return empty (unless NULL owner)
```

### Test 2: Client-Side Restriction

```javascript
// Browser console (authenticated as User A)
const { data } = await supabase.from('models').select('*');
// Should only return models where owner_id = current user
```

### Test 3: Service Role Bypass

```javascript
// Server-side API route
const supabase = getServiceClient(); // Uses service role
const { data } = await supabase.from('models').select('*');
// Returns ALL models (no RLS)
```

## Migration Path

To enable RLS:

1. Run `sql/schema.sql` to create tables
2. Run `sql/rls_policies.sql` to enable RLS and add policies
3. Test with real user authentication
4. Migrate NULL-owned test data to proper owners

## Additional Resources

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Service Role vs Anon Key](https://supabase.com/docs/guides/api/api-keys)
- [EFIR Deploy Guide](./deploy.md)

