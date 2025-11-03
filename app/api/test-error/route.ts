// app/api/test-error/route.ts
// Test route to verify Sentry error capture
// Usage: GET /api/test-error?type=exception|error|validation

import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'exception';

  logger.info('Test error route called', { type });

  switch (type) {
    case 'exception':
      // Throw an exception (will be caught by withErrorHandler)
      throw new Error('Test exception for Sentry - This is intentional');
    
    case 'error':
      // Create an error response (won't be sent to Sentry)
      return createErrorResponse('Test error response', 400);
    
    case 'validation':
      // Simulate a validation error
      return createErrorResponse('Test validation error', 422, {
        field: 'test',
        message: 'This is a test validation error',
      });
    
    case 'sentry':
      // Manually capture a message in Sentry
      Sentry.captureMessage('Test message captured in Sentry', 'info');
      return NextResponse.json({ 
        message: 'Test message sent to Sentry',
        type: 'sentry',
      });
    
    default:
      return NextResponse.json({
        message: 'Test error route',
        usage: '?type=exception|error|validation|sentry',
        types: {
          exception: 'Throws an exception (captured by Sentry)',
          error: 'Returns an error response (not sent to Sentry)',
          validation: 'Returns a validation error (not sent to Sentry)',
          sentry: 'Manually captures a message in Sentry',
        },
      });
  }
});

