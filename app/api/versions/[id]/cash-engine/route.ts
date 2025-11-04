// app/api/versions/[id]/cash-engine/route.ts
// Cash Engine API - On-demand execution and status
// POST: Trigger cash engine execution
// GET: Get cash engine status and convergence results

import { NextRequest, NextResponse } from 'next/server';
import { UuidSchema } from '@/lib/validateRequest';
import { logger } from '@/lib/logger';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { runCashEngineForVersion } from '@/lib/engine/cashEngineService';
import { getServiceClient } from '@/lib/supabaseServer';
import { z } from 'zod';

const PostBodySchema = z.object({
  forceRecalculation: z.boolean().optional().default(false),
  yearRange: z.object({
    start: z.number().int().min(2025).max(2052),
    end: z.number().int().min(2025).max(2052),
  }).optional(),
});

/**
 * POST /api/versions/[id]/cash-engine
 * Trigger cash engine execution for a version
 */
export const POST = withErrorHandler(async (
  req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return createErrorResponse('Missing route parameters', 400);
  }
  const params = await ctx.params;
  const { id } = params as { id: string };

  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return createErrorResponse('Invalid version ID format', 400, uuidValidation.error.issues);
  }

  // Parse and validate body
  let body = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional, use defaults
  }

  const validation = PostBodySchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse('Invalid request body', 400, validation.error.issues);
  }

  const { forceRecalculation, yearRange } = validation.data;

  logger.info('Cash engine execution requested', { 
    versionId: id, 
    forceRecalculation,
    yearRange 
  });

  // Run cash engine
  const result = await runCashEngineForVersion(id, {
    forceRecalculation,
    yearRange,
  });

  if (!result.success) {
    logger.error('Cash engine execution failed', { versionId: id, errors: result.errors });
    return createErrorResponse(
      `Cash engine execution failed: ${result.errors?.join(', ') || 'Unknown error'}`,
      500
    );
  }

  return NextResponse.json({
    ok: true,
    result: {
      converged: result.converged,
      totalIterations: result.totalIterations,
      yearsProcessed: result.yearsProcessed,
      convergenceByYear: result.convergenceByYear,
    },
  });
});

/**
 * GET /api/versions/[id]/cash-engine
 * Get cash engine status and convergence results
 */
export const GET = withErrorHandler(async (
  _req: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return createErrorResponse('Missing route parameters', 400);
  }
  const params = await ctx.params;
  const { id } = params as { id: string };

  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return createErrorResponse('Invalid version ID format', 400, uuidValidation.error.issues);
  }

  const supabase = getServiceClient();

  // Get cached convergence results
  const { data: cached, error } = await supabase
    .from('version_computed')
    .select('computed_value, computed_at')
    .eq('version_id', id)
    .eq('computed_key', 'cash_engine_convergence')
    .single();

  if (error || !cached) {
    return NextResponse.json({
      ok: true,
      hasResults: false,
      message: 'No cash engine results found. Run POST to execute.',
    });
  }

  type ConvergenceResult = {
    convergence?: {
      converged: boolean;
      iterations?: number;
      lastError?: string;
    };
  };

  const results = cached.computed_value as Record<string, ConvergenceResult>;
  const allConverged = Object.values(results).every((r) => r.convergence?.converged ?? false);
  const totalIterations = Object.values(results).reduce(
    (sum: number, r) => sum + (r.convergence?.iterations || 0),
    0
  );

  return NextResponse.json({
    ok: true,
    hasResults: true,
    computedAt: cached.computed_at,
    summary: {
      converged: allConverged,
      totalIterations,
      yearsProcessed: Object.keys(results).length,
    },
    convergenceByYear: Object.fromEntries(
      Object.entries(results).map(([year, result]) => [
        year,
        {
          converged: result.convergence?.converged || false,
          iterations: result.convergence?.iterations || 0,
          lastError: result.convergence?.lastError,
        },
      ])
    ),
  });
});

