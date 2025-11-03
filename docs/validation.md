# API Route Validation Guide

All API routes in EFIR now use **Zod** for input validation with consistent error responses.

## Overview

- ✅ **Type-safe**: All request bodies and params are validated with Zod schemas
- ✅ **Consistent errors**: All validation errors return 400 with structured details
- ✅ **No `any` types**: All routes are fully typed
- ✅ **UUID validation**: All route parameters validate UUID format
- ✅ **Negative tests**: Test cases for malformed inputs included

## Validation Helper

The `lib/validateRequest.ts` module provides:

- `validateBody(schema, body)` - Validates request body, returns 400 on error
- `validateQuery(schema, searchParams)` - Validates query parameters
- `UuidSchema` - Reusable UUID validation schema

### Example Usage

```typescript
import { validateBody, UuidSchema } from '@/lib/validateRequest';
import { z } from 'zod';

const BodySchema = z.object({
  name: z.string().min(1).optional(),
  status: z.enum(['draft', 'ready', 'locked']),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Validate UUID param
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json({ error: 'Invalid UUID' }, { status: 400 });
  }

  // Validate body
  const validation = validateBody(BodySchema, await req.json());
  if (!validation.success) {
    return validation.response; // Returns 400 with Zod error details
  }
  
  const { name, status } = validation.data; // Fully typed!
});
```

## Route Schemas

### `/api/versions/[id]/clone`

**Body Schema:**
```typescript
{
  name?: string;           // Optional, min 1 character if provided
  includeChildren?: boolean; // Optional, defaults to true
}
```

**Validation:**
- UUID param validated
- `name` must be string (if provided)
- `includeChildren` must be boolean (if provided)
- Empty string for `name` is rejected

**Error Response:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "name",
      "message": "String must contain at least 1 character(s)",
      "code": "too_small"
    }
  ]
}
```

### `/api/versions/[id]/status`

**Body Schema:**
```typescript
{
  status: 'draft' | 'ready' | 'locked';  // Required, enum
  note?: string;                         // Optional
}
```

**Validation:**
- UUID param validated
- `status` is required and must be one of the enum values
- `note` must be string if provided

**Error Response:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "path": "status",
      "message": "Invalid enum value. Expected 'draft' | 'ready' | 'locked', received 'invalid'",
      "code": "invalid_enum_value"
    }
  ]
}
```

### `/api/versions/[id]/validate`

**Query Params:** None currently

**Validation:**
- UUID param validated

**Error Response:**
```json
{
  "error": "Invalid version ID format",
  "details": [
    {
      "path": "id",
      "message": "Must be a valid UUID",
      "code": "invalid_type"
    }
  ]
}
```

### `/api/versions/[id]/history`

**Query Params:** None currently

**Validation:**
- UUID param validated

**Error Response:**
```json
{
  "error": "Invalid version ID format",
  "details": [
    {
      "path": "id",
      "message": "Must be a valid UUID",
      "code": "invalid_type"
    }
  ]
}
```

## Error Response Format

All validation errors follow this consistent format:

```typescript
{
  error: string;              // Human-readable error message
  details: Array<{           // Array of Zod validation issues
    path: string;            // Dot-notation path to invalid field
    message: string;         // Specific error message
    code: string;            // Zod error code (e.g., "invalid_type", "too_small")
  }>;
}
```

## Testing

### Manual Testing

Run the test script:

```bash
bash tests/test-validation.sh
```

Or test individual endpoints:

```bash
# Invalid UUID
curl -X POST http://localhost:3000/api/versions/invalid-uuid/clone \
  -H "Content-Type: application/json" \
  -d '{}'

# Invalid type
curl -X POST http://localhost:3000/api/versions/22222222-2222-2222-2222-222222222222/clone \
  -H "Content-Type: application/json" \
  -d '{"name": 123}'

# Invalid enum
curl -X PATCH http://localhost:3000/api/versions/22222222-2222-2222-2222-222222222222/status \
  -H "Content-Type: application/json" \
  -d '{"status": "invalid"}'
```

### Test Cases

See `tests/api-validation.test.ts` for comprehensive test cases including:

- Invalid UUID formats
- Wrong data types
- Missing required fields
- Invalid enum values
- Empty strings where min length required

## Best Practices

### ✅ DO

- Use `validateBody` for all request bodies
- Validate UUID params with `UuidSchema`
- Return validation errors with `validation.response`
- Use Zod enums for status values
- Make optional fields explicit with `.optional()`

### ❌ DON'T

- Use `any` types in request handlers
- Manually validate inputs (use Zod)
- Return different error formats (use helper functions)
- Skip validation for "optional" endpoints
- Accept invalid UUID formats

## Migration Notes

All routes have been updated to:

1. ✅ Remove `any` types
2. ✅ Use Zod schemas
3. ✅ Return consistent 400 errors
4. ✅ Validate UUID parameters
5. ✅ Use `withErrorHandler` for error capture

## Related

- [Zod Documentation](https://zod.dev/)
- [Error Handling Guide](./observability.md)
- [API Routes](./api.md) (coming soon)

