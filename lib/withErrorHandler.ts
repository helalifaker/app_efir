// lib/withErrorHandler.ts
// Wrapper for API route handlers to capture errors in Sentry

import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { randomUUID } from 'crypto';
import { logger } from './logger';
import { HttpError } from './errors';
import { ERROR_CODES } from './constants';

type RouteContext = {
  params?: Promise<Record<string, string>>;
};

type ApiHandler = (
  req: NextRequest,
  context?: RouteContext
) => Promise<NextResponse> | NextResponse;

/**
 * Standardized error response format
 */
interface StandardErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
  timestamp?: string;
  correlationId?: string;
}

/**
 * Generate or extract correlation ID from request
 * Uses X-Request-ID header if present, otherwise generates a new UUID
 */
function getCorrelationId(req: NextRequest): string {
  // Check for existing correlation ID in headers
  const existingId = req.headers.get('x-request-id') || 
                     req.headers.get('x-correlation-id') ||
                     req.headers.get('x-trace-id');
  
  if (existingId) {
    return existingId;
  }
  
  // Generate new correlation ID (UUID v4 format)
  // Using randomUUID() from crypto module (available in Node.js 16+)
  return randomUUID();
}

/**
 * Wraps an API route handler to capture errors in Sentry
 * and return safe error messages to clients
 */
export function withErrorHandler(handler: ApiHandler) {
  return async (req: NextRequest, context?: RouteContext): Promise<NextResponse> => {
    // Generate or extract correlation ID for this request
    const correlationId = getCorrelationId(req);
    
    // Add correlation ID to response headers for client tracing
    const addCorrelationHeader = (response: NextResponse) => {
      response.headers.set('X-Correlation-ID', correlationId);
      return response;
    };
    
    try {
      const response = await handler(req, context);
      return addCorrelationHeader(response);
    } catch (error: unknown) {
      // Log error with correlation ID
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('API route error', error, {
        path: req.url,
        method: req.method,
        correlationId,
      });
      
      // Capture in Sentry with correlation ID and additional context
      Sentry.captureException(error, {
        tags: {
          route: req.url,
          method: req.method,
          correlationId,
        },
        extra: {
          url: req.url,
          method: req.method,
          correlationId,
          headers: {
            'user-agent': req.headers.get('user-agent'),
            'content-type': req.headers.get('content-type'),
          },
        },
      });
      
      // Handle HttpError with proper status code
      if (error instanceof HttpError) {
        const response: StandardErrorResponse = {
          error: error.message,
          code: getErrorCode(error.status),
          timestamp: new Date().toISOString(),
          correlationId,
        };
        
        if (process.env.NODE_ENV === 'development' && error.details) {
          response.details = error.details;
        }
        
        const httpResponse = NextResponse.json(response, { status: error.status });
        return addCorrelationHeader(httpResponse);
      }
      
      // Return safe error message for unknown errors (don't expose internal details)
      const response: StandardErrorResponse = {
        error: process.env.NODE_ENV === 'production'
          ? 'An internal server error occurred'
          : errorMessage,
        code: ERROR_CODES.INTERNAL_ERROR,
        timestamp: new Date().toISOString(),
        correlationId,
      };
      
      // Include error details in development
      if (process.env.NODE_ENV === 'development') {
        response.details = error instanceof Error ? error.stack : String(error);
      }
      
      const httpResponse = NextResponse.json(response, { status: 500 });
      return addCorrelationHeader(httpResponse);
    }
  };
}

/**
 * Maps HTTP status codes to error codes
 */
function getErrorCode(status: number): string {
  switch (status) {
    case 400:
      return ERROR_CODES.VALIDATION_FAILED;
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.NOT_FOUND;
    case 500:
    default:
      return ERROR_CODES.INTERNAL_ERROR;
  }
}

/**
 * Creates a safe error response without Sentry (for known/expected errors)
 * Note: This function doesn't have access to the request, so correlation ID
 * should be added by the caller if needed
 */
export function createErrorResponse(
  message: string,
  status: number = 500,
  details?: unknown
): NextResponse {
  logger.warn(`API error response: ${message}`, { status, details });
  
  const response: StandardErrorResponse = {
    error: message,
    code: getErrorCode(status),
    timestamp: new Date().toISOString(),
  };
  
  if (process.env.NODE_ENV === 'development' && details) {
    response.details = details;
  }
  
  return NextResponse.json(response, { status });
}

