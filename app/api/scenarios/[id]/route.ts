// app/api/scenarios/[id]/route.ts
// API routes for individual scenario operations

import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabaseServer';
import { withErrorHandler, createErrorResponse } from '@/lib/withErrorHandler';
import { UpdateScenarioSchema } from '@/lib/schemas/planner';
import { logger } from '@/lib/logger';

/**
 * GET /api/scenarios/[id]
 * Get scenario details with stats
 */
export const GET = withErrorHandler(async (
  request: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return createErrorResponse('Missing route parameters', 400);
  }
  const params = await ctx.params;
  const scenarioId = params.id;
  const supabase = getServiceClient();

  // Get scenario with version info
  const { data: scenario, error } = await supabase
    .from('scenarios')
    .select(`
      *,
      version:model_versions!inner(
        id,
        name,
        status,
        model:models!inner(id, name)
      )
    `)
    .eq('id', scenarioId)
    .single();

  if (error || !scenario) {
    logger.error('Scenario not found', error, { scenarioId });
    return createErrorResponse('Scenario not found', 404);
  }

  // Get tab count for this scenario
  const { count: tabCount } = await supabase
    .from('version_tabs')
    .select('*', { count: 'exact', head: true })
    .eq('scenario_id', scenarioId);

  // Get driver value count for this scenario
  const { count: driverCount } = await supabase
    .from('driver_values')
    .select('*', { count: 'exact', head: true })
    .eq('scenario_id', scenarioId);

  const scenarioWithStats = {
    ...scenario,
    tab_count: tabCount || 0,
    driver_count: driverCount || 0,
  };

  return NextResponse.json(scenarioWithStats);
});

/**
 * PATCH /api/scenarios/[id]
 * Update scenario details
 */
export const PATCH = withErrorHandler(async (
  request: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return createErrorResponse('Missing route parameters', 400);
  }
  const params = await ctx.params;
  const scenarioId = params.id;
  const body = await request.json();

  // Validate request
  const validation = UpdateScenarioSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse('Invalid request', 400, validation.error.issues);
  }

  const supabase = getServiceClient();

  // Check if scenario exists and is not base scenario (base scenarios can't change name/type)
  const { data: existing, error: fetchError } = await supabase
    .from('scenarios')
    .select('id, type')
    .eq('id', scenarioId)
    .single();

  if (fetchError || !existing) {
    return createErrorResponse('Scenario not found', 404);
  }

  if (existing.type === 'base' && validation.data.name) {
    return createErrorResponse('Cannot rename base scenario', 400);
  }

  // Update scenario
  const { data: updated, error: updateError } = await supabase
    .from('scenarios')
    .update({
      ...validation.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', scenarioId)
    .select()
    .single();

  if (updateError) {
    logger.error('Failed to update scenario', updateError, { scenarioId });
    return createErrorResponse('Failed to update scenario', 500);
  }

  logger.info('Scenario updated', { scenarioId });
  return NextResponse.json(updated);
});

/**
 * DELETE /api/scenarios/[id]
 * Delete a scenario
 */
export const DELETE = withErrorHandler(async (
  request: NextRequest,
  ctx?: { params?: Promise<Record<string, string>> }
) => {
  if (!ctx?.params) {
    return createErrorResponse('Missing route parameters', 400);
  }
  const params = await ctx.params;
  const scenarioId = params.id;
  const supabase = getServiceClient();

  // Check if scenario exists and is not base scenario
  const { data: existing, error: fetchError } = await supabase
    .from('scenarios')
    .select('id, type, version_id')
    .eq('id', scenarioId)
    .single();

  if (fetchError || !existing) {
    return createErrorResponse('Scenario not found', 404);
  }

  if (existing.type === 'base') {
    return createErrorResponse('Cannot delete base scenario', 400);
  }

  // Delete scenario (cascade will delete related data)
  const { error: deleteError } = await supabase
    .from('scenarios')
    .delete()
    .eq('id', scenarioId);

  if (deleteError) {
    logger.error('Failed to delete scenario', deleteError, { scenarioId });
    return createErrorResponse('Failed to delete scenario', 500);
  }

  logger.info('Scenario deleted', { scenarioId, versionId: existing.version_id });
  return NextResponse.json({ success: true });
});
