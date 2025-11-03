// lib/withErrorHandler.ts
// Wrapper for API route handlers to capture errors in Sentry

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { logger } from './logger';

type ApiHandler = (
  req: NextRequest,
  context?: any
) => Promise<NextResponse> | NextResponse;

/**
 * Wraps an API route handler to capture errors in Sentry
 * and return safe error messages to clients
 */
export function withErrorHandler(handler: ApiHandler) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      const response = await handler(req, context);
      return response;
    } catch (error: unknown) {
      // Log error
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('API route error', error, {
        path: req.url,
        method: req.method,
      });
      
      // Capture in Sentry with additional context
      Sentry.captureException(error, {
        tags: {
          route: req.url,
          method: req.method,
        },
        extra: {
          url: req.url,
          method: req.method,
          headers: {
            'user-agent': req.headers.get('user-agent'),
            'content-type': req.headers.get('content-type'),
          },
        },
      });
      
      // Return safe error message (don't expose internal details)
      const status = error instanceof Error && 'status' in error 
        ? (error as any).status 
        : 500;
      
      return NextResponse.json(
        {
          error: process.env.NODE_ENV === 'production'
            ? 'An internal server error occurred'
            : errorMessage,
          // Include error details in development
          ...(process.env.NODE_ENV === 'development' && {
            details: error instanceof Error ? error.stack : String(error),
          }),
        },
        { status: typeof status === 'number' ? status : 500 }
      );
    }
  };
}

/**
 * Creates a safe error response without Sentry (for known/expected errors)
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: any
): NextResponse {
  logger.warn(`API error response: ${message}`, { status, details });
  
  return NextResponse.json(
    {
      error: message,
      ...(process.env.NODE_ENV === 'development' && details && { details }),
    },
    { status }
  );
}

