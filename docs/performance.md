# Performance Optimization Guide

EFIR is optimized for fast page loads and efficient database queries through strategic indexing, caching, and pagination.

## Database Indexes

### Performance Indexes (`sql/perf_indexes.sql`)

Run after `schema.sql` and `rls_policies.sql`:

```sql
-- Optimize version_tabs queries
CREATE INDEX idx_version_tabs_version_tab ON version_tabs(version_id, tab);

-- Optimize validation status checks
CREATE INDEX idx_version_validations_version_severity ON version_validations(version_id, severity);
CREATE INDEX idx_version_validations_version_created ON version_validations(version_id, created_at DESC);

-- Optimize history pagination
CREATE INDEX idx_vsh_version_changed_at ON version_status_history(version_id, changed_at DESC);

-- Optimize model_versions joins
CREATE INDEX idx_model_versions_model_created ON model_versions(model_id, created_at DESC);
CREATE INDEX idx_model_versions_status_created ON model_versions(status, created_at DESC);
```

### Query Patterns Optimized

1. **Version Detail Page** (`/version-detail/[id]`)
   - `version_tabs`: `(version_id, tab)` → Fast tab lookups
   - `version_validations`: `(version_id, severity)` → Status check queries
   - `version_status_history`: `(version_id, changed_at DESC)` → Ordered history

2. **Compare Page** (`/compare`)
   - `version_tabs`: `(version_id, tab)` → Multi-version tab queries
   - `model_versions`: `(model_id, created_at DESC)` → Join with models

3. **Status Transitions**
   - `version_validations`: `(version_id, severity)` → Blocking validation checks

### Verifying Index Usage

```sql
-- Check index usage in query plans
EXPLAIN ANALYZE
SELECT * FROM version_tabs 
WHERE version_id = '...' AND tab IN ('pnl', 'bs', 'cf');

-- Verify indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('version_tabs', 'version_validations', 'version_status_history', 'model_versions')
ORDER BY tablename, indexname;
```

## Server-Side Caching

### Cached Functions

#### `getVersionWithTabs(versionId)`

Caches version detail data with revalidation tags:
- **Tags**: `versions`, `version-tabs`, `version-validations`, `version-history`
- **Revalidate**: 60 seconds
- **Cache Key**: `version-with-tabs-{versionId}`

Used in:
- `/version-detail/[id]` page

#### `getCompareData(versionIds, baselineId)`

Caches compare page data:
- **Tags**: `compare`, `versions`, `version-tabs`
- **Revalidate**: 60 seconds
- **Cache Key**: `compare-{sortedIds}-{baselineId}`

Used in:
- `/compare` page

### Cache Invalidation

Cache is automatically invalidated when data changes:

1. **Status Updates** (`/api/versions/[id]/status`)
   - Revalidates: `versions`, `version-tabs`, `version-validations`, `version-history`, `version-{id}`

2. **Version Clone** (`/api/versions/[id]/clone`)
   - Revalidates: `versions`, `version-tabs`, `version-validations`

3. **Manual Revalidation** (if needed)
   ```typescript
   import { revalidateVersion } from '@/lib/getVersionWithTabs';
   import { revalidateCompare } from '@/lib/getCompareData';
   
   // Revalidate specific version
   revalidateVersion(versionId);
   
   // Revalidate compare data
   revalidateCompare();
   ```

### Cache Strategy

- **Time-based revalidation**: 60 seconds (stale-while-revalidate)
- **Tag-based invalidation**: On mutations
- **Safe for concurrent requests**: Multiple users see consistent data

## API Pagination

### History API (`/api/versions/[id]/history`)

Supports pagination with query parameters:

```typescript
GET /api/versions/{id}/history?limit=50&offset=0
```

**Parameters**:
- `limit`: Number of items per page (1-100, default: 50)
- `offset`: Number of items to skip (default: 0)

**Response**:
```json
{
  "items": [...],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

**Example**:
```bash
# First page
GET /api/versions/abc/history?limit=50&offset=0

# Second page
GET /api/versions/abc/history?limit=50&offset=50
```

### Performance Considerations

- **Default limit**: 50 items (prevents large payloads)
- **Max limit**: 100 items (prevents abuse)
- **Index usage**: `(version_id, changed_at DESC)` ensures efficient pagination
- **Count query**: Uses `count: 'exact'` for accurate pagination metadata

## Performance Metrics

### Target Metrics

- **Page Load**: < 2 seconds (Lighthouse)
- **Database Queries**: < 100ms per query
- **Cache Hit Rate**: > 80% for read-heavy pages
- **API Response**: < 500ms for paginated endpoints

### Monitoring

1. **Database Query Performance**
   ```sql
   -- Check slow queries
   SELECT 
     query,
     calls,
     total_time,
     mean_time
   FROM pg_stat_statements
   WHERE query LIKE '%version_tabs%'
   ORDER BY mean_time DESC
   LIMIT 10;
   ```

2. **Cache Effectiveness**
   - Monitor cache hit/miss rates in production
   - Use Next.js analytics for cache performance

3. **Lighthouse Scores**
   - Run Lighthouse CI on deployments
   - Target: Performance > 90, Best Practices > 90

## Optimization Checklist

### ✅ Implemented

- [x] Composite indexes on frequently queried columns
- [x] Server-side caching with `unstable_cache`
- [x] Tag-based cache invalidation
- [x] Pagination for history API
- [x] Limit history queries to 50 items in `getVersionWithTabs`
- [x] Indexed foreign keys and join columns

### 🔄 Future Optimizations

- [ ] Add database connection pooling
- [ ] Implement query result memoization for repeated requests
- [ ] Add Redis caching layer for high-traffic scenarios
- [ ] Optimize JSONB queries with GIN indexes if needed
- [ ] Add database query monitoring/alerting

## Best Practices

### DO ✅

- Use indexes for all WHERE and ORDER BY clauses
- Cache read-heavy data at the server level
- Paginate large result sets
- Revalidate cache on mutations
- Monitor query performance with EXPLAIN ANALYZE

### DON'T ❌

- Query without indexes on large tables
- Fetch unlimited rows without pagination
- Cache data that changes frequently
- Skip cache invalidation on mutations
- Over-fetch data (select only needed columns)

## Troubleshooting

### Slow Queries

1. **Check index usage**:
   ```sql
   EXPLAIN ANALYZE SELECT ...;
   ```
   Look for "Index Scan" vs "Seq Scan"

2. **Verify indexes exist**:
   ```sql
   \d+ version_tabs
   ```

3. **Check query plan**:
   - Use `EXPLAIN ANALYZE` to see actual execution time
   - Look for "Seq Scan" (full table scan) - should use indexes

### Cache Not Updating

1. **Check revalidation tags**:
   - Ensure mutations call `revalidateTag()`
   - Verify tag names match between cache and revalidation

2. **Check cache TTL**:
   - Default is 60 seconds
   - Reduce if data freshness is critical

### High Memory Usage

1. **Limit pagination**:
   - Ensure max limit is enforced (100 items)
   - Consider reducing default limit for large datasets

2. **Review cache size**:
   - Monitor Next.js cache memory usage
   - Consider reducing cache TTL if needed

## Related Documentation

- [Database Schema](./setup.md#database-setup)
- [RLS Policies](./security.md)
- [API Validation](./validation.md)

