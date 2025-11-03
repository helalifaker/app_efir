// lib/validateRequest.ts
// Helper for Zod validation with consistent error responses

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from './logger';

/**
 * Validates request body with Zod schema
 * Returns validated data or a 400 error response with Zod error details
 */
export function validateBody<T extends z.ZodTypeAny>(
  schema: T,
  body: unknown
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Validation error', { errors: error.issues });
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Validation failed',
            details: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          },
          { status: 400 }
        ),
      };
    }
    throw error;
  }
}

/**
 * Validates query parameters with Zod schema
 */
export function validateQuery<T extends z.ZodTypeAny>(
  schema: T,
  searchParams: URLSearchParams
): { success: true; data: z.infer<T> } | { success: false; response: NextResponse } {
  // Convert URLSearchParams to object
  const params: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    params[key] = value;
  });

  try {
    const data = schema.parse(params);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Query validation error', { errors: error.issues });
      return {
        success: false,
        response: NextResponse.json(
          {
            error: 'Invalid query parameters',
            details: error.issues.map((issue) => ({
              path: issue.path.join('.'),
              message: issue.message,
              code: issue.code,
            })),
          },
          { status: 400 }
        ),
      };
    }
    throw error;
  }
}

/**
 * Validates UUID parameter
 */
export const UuidSchema = z.string().uuid('Invalid UUID format');

