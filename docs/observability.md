# EFIR Observability Guide

This guide covers error tracking, logging, and monitoring setup using Sentry.

## Overview

EFIR uses **Sentry** for error tracking and monitoring. The integration includes:

- ✅ Server-side error capture (API routes)
- ✅ Client-side error capture (React components)
- ✅ PII masking (Personally Identifiable Information)
- ✅ Leveled logging with `logger.ts`
- ✅ Error handler wrapper for API routes

## Setup

### 1. Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Create a free account or sign in
3. Create a new project → Select **Next.js**
4. Copy your **DSN** (Data Source Name)

### 2. Environment Variables

Add to your `.env.local` (and Vercel):

```bash
# Sentry Configuration
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org-name
SENTRY_PROJECT=app-efir
```

**Where to find**:
- **DSN**: Sentry project → Settings → Client Keys (DSN)
- **ORG**: Sentry organization slug
- **PROJECT**: Sentry project slug

### 3. Verify Installation

Run the test error route:

```bash
# Test exception capture
curl http://localhost:3000/api/test-error?type=exception

# Test manual message
curl http://localhost:3000/api/test-error?type=sentry
```

Check your Sentry dashboard → Issues to see the captured errors.

## Architecture

### Error Handling Flow

```
API Route Error
    ↓
withErrorHandler wrapper
    ↓
logger.error() (logs with PII masking)
    ↓
Sentry.captureException() (sends to Sentry)
    ↓
Safe error response (no sensitive data)
```

### PII Masking

Sentry automatically masks sensitive data:

- **Headers**: `authorization`, `cookie`, `x-api-key`
- **Query Params**: `token`, `key`, `secret`
- **Request Body**: `password`, `token`, `secret`, `apiKey`
- **User Data**: Only user ID (no email, IP, etc.)

See `sentry.client.config.ts` and `sentry.server.config.ts` for configuration.

## Usage

### API Routes

Wrap route handlers with `withErrorHandler`:

```typescript
import { withErrorHandler } from '@/lib/withErrorHandler';

export const GET = withErrorHandler(async (req: NextRequest) => {
  // Your route logic
  // Uncaught errors are automatically captured
});
```

### Logging

Use the `logger` utility instead of `console.log`:

```typescript
import { logger } from '@/lib/logger';

// Info
logger.info('User logged in', { userId: '123' });

// Warning
logger.warn('Slow database query', { duration: 5000 });

// Error
logger.error('Failed to fetch data', error, { operation: 'fetch' });

// Debug (development only)
logger.debug('Cache hit', { key: 'settings' });
```

**Benefits**:
- ✅ Automatic PII masking
- ✅ Consistent formatting
- ✅ Leveled logging (debug only in dev)
- ✅ Structured context

### Known Errors (No Sentry)

For expected errors (validation, user input), use `createErrorResponse`:

```typescript
import { createErrorResponse } from '@/lib/withErrorHandler';

if (invalid) {
  return createErrorResponse('Invalid input', 400, { field: 'email' });
}
```

This logs a warning but **doesn't** send to Sentry (not an unexpected error).

### Manual Sentry Capture

For custom events:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.captureMessage('Custom event', 'info');
Sentry.captureException(error, { tags: { feature: 'payments' } });
```

## Configuration Files

### Sentry Configs

- **`sentry.client.config.ts`** - Client-side (browser) configuration
- **`sentry.server.config.ts`** - Server-side (API routes) configuration
- **`sentry.edge.config.ts`** - Edge runtime configuration
- **`instrumentation.ts`** - Next.js instrumentation (auto-loads configs)

### Next.js Config

`next.config.ts` includes Sentry webpack plugin for:
- Source map upload
- Automatic SDK tree-shaking
- Build-time optimization

## Testing

### Test Error Route

The `/api/test-error` route provides multiple test scenarios:

```bash
# Test exception (captured by Sentry)
GET /api/test-error?type=exception

# Test error response (not sent to Sentry)
GET /api/test-error?type=error

# Test validation error
GET /api/test-error?type=validation

# Test manual Sentry message
GET /api/test-error?type=sentry

# Show usage
GET /api/test-error
```

### Verification

1. **Trigger an error**: Visit `/api/test-error?type=exception`
2. **Check Sentry**: Go to Sentry dashboard → Issues
3. **Verify details**: Error should include stack trace, context, but no PII

## Production Best Practices

### ✅ DO

- Use `withErrorHandler` for all API routes
- Use `logger` instead of `console.log`
- Use `createErrorResponse` for expected errors
- Monitor Sentry dashboard regularly
- Set up alerts in Sentry for critical errors

### ❌ DON'T

- Log sensitive data (passwords, tokens, keys)
- Expose internal error details to clients
- Ignore Sentry alerts
- Use `console.log` in production code

## Monitoring

### Sentry Dashboard

Key metrics to monitor:

- **Error Rate**: Errors per minute/hour
- **Affected Users**: How many users hit errors
- **Release Health**: Error rate by deployment
- **Performance**: Slow API routes

### Alerts

Set up Sentry alerts for:

- High error rate (> 10 errors/minute)
- New error types
- Critical errors (500 status codes)
- Performance degradation

## Troubleshooting

### Errors Not Appearing in Sentry

**Check**:
1. `NEXT_PUBLIC_SENTRY_DSN` is set correctly
2. Sentry project is active (not paused)
3. Network connectivity (check browser console)
4. Build completed successfully

**Debug**:
```typescript
// In sentry config, enable debug mode
debug: true, // Set to true temporarily
```

### Too Many Errors

**Filter**:
- Update `ignoreErrors` in Sentry config
- Use Sentry's release filtering
- Set up issue rules in Sentry dashboard

### PII Leaking

**Verify**:
- Check `beforeSend` hooks in Sentry configs
- Review `logger.ts` masking logic
- Test with real data in staging

## Source Maps

Sentry automatically uploads source maps in production builds:

- ✅ Better stack traces
- ✅ Original file names
- ✅ Line numbers

**Note**: Source maps are hidden from Sentry UI (security).

## Cost

Sentry free tier includes:
- 5,000 errors/month
- 1 project
- 30-day retention

For production, consider upgrading to Team plan for:
- Unlimited errors
- Multiple projects
- 90-day retention
- Performance monitoring

## Additional Resources

- [Sentry Next.js Docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/)
- [Sentry Error Handling](https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/)
- [EFIR Security Guide](./security.md) - PII protection

## Support

For Sentry issues:
- [Sentry Support](https://sentry.io/support/)
- [Sentry Discord](https://discord.gg/sentry)

